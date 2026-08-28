import { randomUUID } from "node:crypto";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { describe, expect, it } from "vitest";

import { mergeServices } from "@/lib/data/service-merge";
import type { Transaction } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { withTransaction } from "@/test/lib/with-transaction";

type Tx = Transaction;

async function seedService(tx: Tx): Promise<string> {
	const [type, status] = await Promise.all([
		tx.query.serviceTypes.findFirst({ columns: { id: true } }),
		tx.query.serviceStatuses.findFirst({ columns: { id: true } }),
	]);
	assert(type, "no service_types seeded in database");
	assert(status, "no service_statuses seeded in database");

	const [row] = await tx
		.insert(schema.services)
		.values({ name: `merge-test-${randomUUID()}`, statusId: status.id, typeId: type.id })
		.returning({ id: schema.services.id });
	assert(row);
	return row.id;
}

async function seedSocialMedia(tx: Tx): Promise<string> {
	const type = await tx.query.socialMediaTypes.findFirst({ columns: { id: true } });
	assert(type, "no social_media_types seeded in database");

	const [row] = await tx
		.insert(schema.socialMedia)
		.values({
			name: `merge-test-${randomUUID()}`,
			typeId: type.id,
			url: `https://example.com/${randomUUID()}`,
		})
		.returning({ id: schema.socialMedia.id });
	assert(row);
	return row.id;
}

async function getEntityTypeId(tx: Tx, type: "organisational_units"): Promise<string> {
	const row = await tx.query.entityTypes.findFirst({ where: { type }, columns: { id: true } });
	assert(row, `${type} entity type not found in database`);
	return row.id;
}

/** A bare organisational-unit _document_, which is the endpoint services relate to. */
async function seedOrganisationalUnitDocument(tx: Tx): Promise<string> {
	const typeId = await getEntityTypeId(tx, "organisational_units");
	const [row] = await tx
		.insert(schema.entities)
		.values({ typeId })
		.returning({ id: schema.entities.id });
	assert(row);
	return row.id;
}

async function seedCountryReport(tx: Tx): Promise<string> {
	const typeId = await getEntityTypeId(tx, "organisational_units");
	const [country] = await tx
		.insert(schema.entities)
		.values({ typeId })
		.returning({ id: schema.entities.id });
	assert(country);

	// A year no seeded campaign uses — `reporting_campaigns.year` is unique.
	const [campaign] = await tx
		.insert(schema.reportingCampaigns)
		.values({ year: 9000 + Math.floor(Math.random() * 900) })
		.returning({ id: schema.reportingCampaigns.id });
	assert(campaign);

	const [report] = await tx
		.insert(schema.countryReports)
		.values({ campaignId: campaign.id, countryDocumentId: country.id })
		.returning({ id: schema.countryReports.id });
	assert(report);
	return report.id;
}

async function getServiceRoles(tx: Tx): Promise<{ owner: string; provider: string }> {
	const roles = await tx.query.organisationalUnitServiceRoles.findMany({
		columns: { id: true, role: true },
	});
	const owner = roles.find((role) => role.role === "service_owner")?.id;
	const provider = roles.find((role) => role.role === "service_provider")?.id;
	assert(owner != null && provider != null, "service roles not seeded in database");
	return { owner, provider };
}

describe("mergeServices", () => {
	it("rejects merging a service into itself and leaves it intact", async () => {
		await withTransaction(async (tx) => {
			const id = await seedService(tx);

			await expect(mergeServices(tx, id, id)).rejects.toThrow(
				"Cannot merge a service into itself.",
			);

			expect(await tx.query.services.findFirst({ where: { id } })).toBeDefined();
		});
	});

	it("re-points unit roles, deduping only the unit that held the same role on both", async () => {
		await withTransaction(async (tx) => {
			const source = await seedService(tx);
			const target = await seedService(tx);
			const { owner, provider } = await getServiceRoles(tx);
			const unitBoth = await seedOrganisationalUnitDocument(tx);
			const unitSourceOnly = await seedOrganisationalUnitDocument(tx);

			await tx.insert(schema.servicesToOrganisationalUnits).values([
				{ serviceId: source, organisationalUnitDocumentId: unitBoth, roleId: owner },
				{ serviceId: target, organisationalUnitDocumentId: unitBoth, roleId: owner },
				// Same unit, different role: a genuine second row that must survive the merge.
				{ serviceId: source, organisationalUnitDocumentId: unitBoth, roleId: provider },
				{ serviceId: source, organisationalUnitDocumentId: unitSourceOnly, roleId: provider },
			]);

			await mergeServices(tx, source, target);

			const rows = await tx
				.select({
					organisationalUnitDocumentId:
						schema.servicesToOrganisationalUnits.organisationalUnitDocumentId,
					roleId: schema.servicesToOrganisationalUnits.roleId,
				})
				.from(schema.servicesToOrganisationalUnits)
				.where(eq(schema.servicesToOrganisationalUnits.serviceId, target));

			expect(rows).toHaveLength(3);
			expect(
				rows.filter((row) => row.organisationalUnitDocumentId === unitBoth && row.roleId === owner),
			).toHaveLength(1);
			expect(
				rows.filter(
					(row) => row.organisationalUnitDocumentId === unitBoth && row.roleId === provider,
				),
			).toHaveLength(1);
			expect(await tx.query.services.findFirst({ where: { id: source } })).toBeUndefined();
		});
	});

	it("re-points social-media links, deduping the account both services listed", async () => {
		await withTransaction(async (tx) => {
			const source = await seedService(tx);
			const target = await seedService(tx);
			const accountBoth = await seedSocialMedia(tx);
			const accountSourceOnly = await seedSocialMedia(tx);

			await tx.insert(schema.servicesToSocialMedia).values([
				{ serviceId: source, socialMediaId: accountBoth },
				{ serviceId: target, socialMediaId: accountBoth },
				{ serviceId: source, socialMediaId: accountSourceOnly },
			]);

			// This table has no unique key, so a plain update would list the shared account twice.
			await mergeServices(tx, source, target);

			const rows = await tx
				.select({ socialMediaId: schema.servicesToSocialMedia.socialMediaId })
				.from(schema.servicesToSocialMedia)
				.where(eq(schema.servicesToSocialMedia.serviceId, target));

			expect(rows.map((row) => row.socialMediaId).toSorted()).toStrictEqual(
				[accountBoth, accountSourceOnly].toSorted(),
			);
		});
	});

	it("dedupes report membership so a report that listed both services keeps one", async () => {
		await withTransaction(async (tx) => {
			const source = await seedService(tx);
			const target = await seedService(tx);
			const reportBoth = await seedCountryReport(tx);
			const reportSourceOnly = await seedCountryReport(tx);

			await tx.insert(schema.countryReportServices).values([
				{ countryReportId: reportBoth, serviceId: source },
				{ countryReportId: reportBoth, serviceId: target },
				{ countryReportId: reportSourceOnly, serviceId: source },
			]);

			await mergeServices(tx, source, target);

			const rows = await tx
				.select({ countryReportId: schema.countryReportServices.countryReportId })
				.from(schema.countryReportServices)
				.where(eq(schema.countryReportServices.serviceId, target));

			// The report that listed both must not end up with a duplicate row, and the report that
			// only knew the source must not lose the service — that is the dangling reference this
			// whole tool exists to prevent.
			expect(rows.map((row) => row.countryReportId).toSorted()).toStrictEqual(
				[reportBoth, reportSourceOnly].toSorted(),
			);
		});
	});

	it("aborts without deleting anything when both services hold the same KPI in one report", async () => {
		await withTransaction(async (tx) => {
			const source = await seedService(tx);
			const target = await seedService(tx);
			const report = await seedCountryReport(tx);

			await tx.insert(schema.countryReportServiceKpis).values([
				{ countryReportId: report, serviceId: source, kpi: "visits", value: 10 },
				{ countryReportId: report, serviceId: target, kpi: "visits", value: 20 },
			]);

			await expect(mergeServices(tx, source, target)).rejects.toThrow("service-kpi-conflict");

			expect(await tx.query.services.findFirst({ where: { id: source } })).toBeDefined();
		});
	});

	it("moves KPIs across when the report records a different category for each service", async () => {
		await withTransaction(async (tx) => {
			const source = await seedService(tx);
			const target = await seedService(tx);
			const report = await seedCountryReport(tx);

			await tx.insert(schema.countryReportServiceKpis).values([
				{ countryReportId: report, serviceId: source, kpi: "visits", value: 10 },
				{ countryReportId: report, serviceId: target, kpi: "downloads", value: 20 },
			]);

			await mergeServices(tx, source, target);

			// The categories do not collide, so the source's value must survive on the target rather
			// than be dropped as a duplicate of "some row this report already had".
			const kpis = await tx
				.select({
					kpi: schema.countryReportServiceKpis.kpi,
					value: schema.countryReportServiceKpis.value,
				})
				.from(schema.countryReportServiceKpis)
				.where(eq(schema.countryReportServiceKpis.serviceId, target))
				.orderBy(schema.countryReportServiceKpis.kpi);

			expect(kpis).toStrictEqual([
				{ kpi: "downloads", value: 20 },
				{ kpi: "visits", value: 10 },
			]);
		});
	});
});
