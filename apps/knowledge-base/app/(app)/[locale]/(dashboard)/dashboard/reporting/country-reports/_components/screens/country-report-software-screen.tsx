import * as schema from "@acdh-knowledge-base/database/schema";
import type { SearchResourcesParams } from "@acdh-knowledge-base/search";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { getAuthorizedCountryReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { assertAuthenticated } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { and, eq, sql } from "@/lib/db/sql";
import { search } from "@/lib/search";

interface CountryReportSoftwareScreenProps {
	reportId: string;
}

/** Shared "software" screen. See {@link getAuthorizedCountryReportForUser} for authorization. */
export async function CountryReportSoftwareScreen(
	props: Readonly<CountryReportSoftwareScreenProps>,
): Promise<ReactNode> {
	const { reportId } = props;

	const { user } = await assertAuthenticated();
	const result = await getAuthorizedCountryReportForUser(
		user,
		reportId,
		(id) =>
			db.query.countryReports.findFirst({
				where: { id },
				columns: { id: true, countryDocumentId: true },
				with: {
					campaign: { columns: { year: true } },
				},
			}),
		"update",
	);

	if (result.status !== "ok") {
		notFound();
	}
	const report = result.data;
	if (report == null) {
		notFound();
	}

	const t = await getExtracted();
	const year = report.campaign.year;
	const consortiumSlugs = new Set<string>();

	const nationalConsortiumSlugs = await db
		.select({ slug: schema.entities.slug })
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.innerJoin(
			schema.entities,
			eq(schema.entities.id, schema.organisationalUnitsRelations.unitDocumentId),
		)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.entities.id),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.where(
			and(
				// unit↔unit relations and the report's country are both document-level.
				eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, report.countryDocumentId),
				eq(schema.organisationalUnitStatus.status, "is_national_consortium_of"),
				eq(
					schema.organisationalUnitTypes.type,
					"national_consortium" as typeof schema.organisationalUnitTypes.$inferSelect.type,
				),
				sql`
					${schema.organisationalUnitsRelations.duration} && tstzrange (
						MAKE_DATE(${year}, 1, 1)::TIMESTAMPTZ,
						MAKE_DATE(${year + 1}, 1, 1)::TIMESTAMPTZ
					)
				`,
			),
		);

	for (const { slug } of nationalConsortiumSlugs) {
		consortiumSlugs.add(slug);
	}

	const softwareSearchParams: SearchResourcesParams = {
		filterBy: `type:=software && source:=ssh-open-marketplace && national_consortia:=[${[...consortiumSlugs].map((slug) => `\`${slug}\``).join(",")}]`,
		perPage: 100,
		query: "*",
		queryBy: ["label", "description", "keywords"],
		sortBy: [{ field: "label", direction: "asc" }],
	};
	const firstSoftwareResult =
		consortiumSlugs.size === 0
			? null
			: await search.collections.resources.search({ ...softwareSearchParams, page: 1 });
	const remainingSoftwareResults =
		firstSoftwareResult?.isOk() === true
			? await Promise.all(
					Array.from(
						{ length: Math.max(firstSoftwareResult.value.pagination.totalPages - 1, 0) },
						(_, index) =>
							search.collections.resources.search({
								...softwareSearchParams,
								page: index + 2,
							}),
					),
				)
			: [];
	const software =
		firstSoftwareResult?.isOk() === true
			? [
					...firstSoftwareResult.value.items,
					...remainingSoftwareResults.flatMap((result) =>
						result.isOk() ? result.value.items : [],
					),
				]
			: [];

	return (
		<div className="flex flex-col gap-y-12">
			<div className="flex flex-col gap-y-4">
				<p className="text-sm text-muted-fg">
					{t("Software contributions from the SSH Open Marketplace.")}
				</p>
				{consortiumSlugs.size === 0 ? (
					<p className="text-sm text-muted-fg italic">
						{t("This country has no national consortium for the selected year.")}
					</p>
				) : software.length === 0 ? (
					<p className="text-sm text-muted-fg italic">
						{t("No SSH Open Marketplace software found for this country.")}
					</p>
				) : (
					<ul className="flex flex-col gap-y-3">
						{software.map(({ document }) => (
							<li key={document.id} className="rounded-md border border-border p-4">
								<div className="flex flex-col gap-y-2">
									{document.links[0] != null ? (
										<a
											className="text-sm font-semibold text-fg underline-offset-4 hover:underline"
											href={document.links[0]}
											rel="noreferrer"
											target="_blank"
										>
											{document.label}
										</a>
									) : (
										<p className="text-sm font-semibold text-fg">{document.label}</p>
									)}
									{document.description !== "" ? (
										<p className="line-clamp-3 text-sm text-muted-fg">{document.description}</p>
									) : null}
								</div>
							</li>
						))}
					</ul>
				)}
			</div>

			<ReportScreenCommentSection reportId={report.id} reportType="country" screenKey="software" />
		</div>
	);
}
