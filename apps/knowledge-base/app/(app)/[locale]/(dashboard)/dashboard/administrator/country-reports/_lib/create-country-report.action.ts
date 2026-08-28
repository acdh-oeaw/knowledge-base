"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { CreateCountryReportActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/country-reports/_lib/create-country-report.schema";
import { publishedEntityVersionWhere } from "@/lib/data/current-entity-version";
import {
	getCarriedOverManualContributions,
	getSnapshotContributionCandidates,
} from "@/lib/data/report-contributions";
import {
	getCarriedOverReportServices,
	getCountryLiveConsortiumServices,
	getCountryReportServiceSeedIds,
} from "@/lib/data/report-services";
import {
	getCarriedOverReportSocialMedia,
	getCountryNationalConsortiumSocialMedia,
	getCountrySocialMedia,
} from "@/lib/data/report-social-media";
import { getCurrentPartnerInstitutions } from "@/lib/data/unit-relations";
import { db } from "@/lib/db";
import { and, eq, sql } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const createCountryReportAction = createMutationAction({
	schema: CreateCountryReportActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "country_reports" },
	revalidate: "/[locale]/dashboard/administrator/country-reports",
	redirect: "/dashboard/administrator/country-reports",

	async preCheck({ input }) {
		const t = await getExtracted();

		const campaign = await db.query.reportingCampaigns.findFirst({
			where: { id: input.campaignId },
			columns: { status: true },
		});

		if (campaign?.status !== "open") {
			return createActionStateError({
				message: t("Only open campaigns can be used for new reports."),
			});
		}

		const existing = await db.query.countryReports.findFirst({
			// input.countryId is the country's document id.
			where: { campaignId: input.campaignId, countryDocumentId: input.countryId },
			columns: { id: true },
		});

		if (existing != null) {
			return createActionStateError({
				message: t("A report for this country and campaign already exists."),
			});
		}

		return undefined;
	},

	async mutate(tx, input) {
		const [created] = await tx
			.insert(schema.countryReports)
			.values({
				campaignId: input.campaignId,
				countryDocumentId: input.countryId,
				status: input.status,
			})
			.returning({ id: schema.countryReports.id });

		assert(created);

		// Seed the (frozen) institutions snapshot from the country's current partner institutions for
		// the campaign year. Editing the live relations happens on the institution/country screens; the
		// report tab only re-captures this snapshot.
		const campaign = await tx.query.reportingCampaigns.findFirst({
			where: { id: input.campaignId },
			columns: { year: true },
		});

		if (campaign != null) {
			const partners = await getCurrentPartnerInstitutions(input.countryId, campaign.year);

			if (partners.length > 0) {
				await tx.insert(schema.countryReportInstitutions).values(
					partners.flatMap((partner) =>
						partner.representationTypes.map((representationType) => {
							return {
								countryReportId: created.id,
								organisationalUnitDocumentId: partner.institutionDocumentId,
								representationType,
							};
						}),
					),
				);
			}

			// Seed contributions: Section 1 (coordinator/deputy) snapshotted from current relations, plus
			// Section 2 (cross-cutting) carried over from last year's report where still active.
			const snapshotContributions = await getSnapshotContributionCandidates(
				input.countryId,
				campaign.year,
			);

			const previousCampaign = await tx.query.reportingCampaigns.findFirst({
				where: { year: campaign.year - 1 },
				columns: { id: true },
			});
			const previousReport =
				previousCampaign == null
					? null
					: await tx.query.countryReports.findFirst({
							where: { campaignId: previousCampaign.id, countryDocumentId: input.countryId },
							columns: { id: true },
						});
			const carriedContributions =
				previousReport == null
					? []
					: await getCarriedOverManualContributions(previousReport.id, campaign.year);

			// Freeze the service coverage set at report creation: current live services attached to the
			// country's national consortium plus still-live memberships from the previous year's report.
			// KPI values are deliberately not carried over.
			const [consortiumServices, carriedServices] = await Promise.all([
				getCountryLiveConsortiumServices(input.countryId, campaign.year, tx),
				previousReport == null ? [] : getCarriedOverReportServices(previousReport.id, tx),
			]);
			const serviceIds = getCountryReportServiceSeedIds(consortiumServices, carriedServices);

			if (serviceIds.length > 0) {
				await tx.insert(schema.countryReportServices).values(
					serviceIds.map((serviceId) => {
						return { countryReportId: created.id, serviceId };
					}),
				);
			}

			// Dedupe by personToOrgUnitId (the report's unique key for a contribution).
			const seen = new Set<string>();
			const contributionRows = [
				...snapshotContributions.map((contribution) => {
					return {
						countryReportId: created.id,
						personToOrgUnitId: contribution.personToOrgUnitId,
						contributionRole: contribution.compensationRole,
					};
				}),
				...carriedContributions.map((contribution) => {
					return {
						countryReportId: created.id,
						personToOrgUnitId: contribution.personToOrgUnitId,
						contributionRole: contribution.contributionRole,
					};
				}),
			].filter((row) => {
				if (seen.has(row.personToOrgUnitId)) {
					return false;
				}
				seen.add(row.personToOrgUnitId);
				return true;
			});

			if (contributionRows.length > 0) {
				await tx.insert(schema.countryReportContributions).values(contributionRows);
			}

			// Project contributions report the total lifetime funding amount, so carry both the project
			// and amount forward while the currently published project remains active in this campaign.
			if (previousReport != null) {
				const projectContributions = await tx
					.select({
						amountEuros: schema.countryReportProjectContributions.amountEuros,
						projectDocumentId: schema.countryReportProjectContributions.projectDocumentId,
					})
					.from(schema.countryReportProjectContributions)
					.innerJoin(
						schema.entityVersions,
						eq(
							schema.entityVersions.entityId,
							schema.countryReportProjectContributions.projectDocumentId,
						),
					)
					.innerJoin(
						schema.entityStatus,
						eq(schema.entityStatus.id, schema.entityVersions.statusId),
					)
					.innerJoin(schema.projects, eq(schema.projects.id, schema.entityVersions.id))
					.where(
						and(
							eq(schema.countryReportProjectContributions.countryReportId, previousReport.id),
							publishedEntityVersionWhere(),
							sql`
								${schema.projects.duration} && tstzrange (
									MAKE_DATE(${campaign.year}, 1, 1)::TIMESTAMPTZ,
									MAKE_DATE(${campaign.year + 1}, 1, 1)::TIMESTAMPTZ
								)
							`,
						),
					);

				if (projectContributions.length > 0) {
					await tx.insert(schema.countryReportProjectContributions).values(
						projectContributions.map((contribution) => {
							return { countryReportId: created.id, ...contribution };
						}),
					);
				}
			}

			// Seed social media from last year's report and the accounts currently linked to the
			// published country and national consortium versions. Carry over accounts only; KPI values
			// are re-entered each year.
			const carriedSocialMediaIds =
				previousReport == null ? [] : await getCarriedOverReportSocialMedia(previousReport.id, tx);
			const countrySocialMediaIds = await getCountrySocialMedia(input.countryId, tx);
			const nationalConsortiumSocialMediaIds = await getCountryNationalConsortiumSocialMedia(
				input.countryId,
				campaign.year,
				tx,
			);
			const socialMediaIds = [
				...new Set([
					...carriedSocialMediaIds,
					...countrySocialMediaIds,
					...nationalConsortiumSocialMediaIds,
				]),
			];

			if (socialMediaIds.length > 0) {
				await tx.insert(schema.countryReportSocialMedia).values(
					socialMediaIds.map((socialMediaId) => {
						return { countryReportId: created.id, socialMediaId };
					}),
				);
			}
		}

		return { subjectId: created.id };
	},
});
