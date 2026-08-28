import { randomUUID } from "node:crypto";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { describe, expect, it } from "vitest";

import { createPublishedDocument } from "@/lib/data/entity-lifecycle";
import { mergeSocialMedia } from "@/lib/data/social-media-merge";
import type { Transaction } from "@/lib/db";
import { eq, sql } from "@/lib/db/sql";
import { withTransaction } from "@/test/lib/with-transaction";

type Tx = Transaction;

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

/** A published organisational unit, returning the _version_ id its social-media links hang off. */
async function seedOrganisationalUnit(tx: Tx): Promise<string> {
	const typeId = await getEntityTypeId(tx, "organisational_units");
	const unitType = await tx.query.organisationalUnitTypes.findFirst({ columns: { id: true } });
	assert(unitType, "no organisational_unit_types seeded in database");

	const { versionId } = await createPublishedDocument(tx, typeId, `sm-merge-${randomUUID()}`);
	await tx
		.insert(schema.organisationalUnits)
		.values({ id: versionId, name: `merge-test-${randomUUID()}`, typeId: unitType.id });

	return versionId;
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

async function getUnitLinks(tx: Tx, unitVersionId: string): Promise<Array<string>> {
	const rows = await tx
		.select({ socialMediaId: schema.organisationalUnitsToSocialMedia.socialMediaId })
		.from(schema.organisationalUnitsToSocialMedia)
		.where(eq(schema.organisationalUnitsToSocialMedia.organisationalUnitId, unitVersionId));
	return rows.map((row) => row.socialMediaId);
}

describe("mergeSocialMedia", () => {
	it("rejects merging an entry into itself and leaves it intact", async () => {
		await withTransaction(async (tx) => {
			const id = await seedSocialMedia(tx);

			await expect(mergeSocialMedia(tx, id, id)).rejects.toThrow(
				"Cannot merge a social-media entry into itself.",
			);

			expect(await tx.query.socialMedia.findFirst({ where: { id } })).toBeDefined();
		});
	});

	it("re-points unit links onto the target, deduping the unit that held both, and deletes the source", async () => {
		await withTransaction(async (tx) => {
			const source = await seedSocialMedia(tx);
			const target = await seedSocialMedia(tx);
			const unitBoth = await seedOrganisationalUnit(tx);
			const unitSourceOnly = await seedOrganisationalUnit(tx);

			await tx.insert(schema.organisationalUnitsToSocialMedia).values([
				{ organisationalUnitId: unitBoth, socialMediaId: source },
				{ organisationalUnitId: unitBoth, socialMediaId: target },
				{ organisationalUnitId: unitSourceOnly, socialMediaId: source },
			]);

			await mergeSocialMedia(tx, source, target);

			// The unit that listed both duplicates must end up with exactly one link, not two — this
			// table has no unique key to fall back on.
			expect(await getUnitLinks(tx, unitBoth)).toStrictEqual([target]);
			expect(await getUnitLinks(tx, unitSourceOnly)).toStrictEqual([target]);
			expect(await tx.query.socialMedia.findFirst({ where: { id: source } })).toBeUndefined();
			expect(await tx.query.socialMedia.findFirst({ where: { id: target } })).toBeDefined();
		});
	});

	it("re-points service links, deduping the service that held both accounts", async () => {
		await withTransaction(async (tx) => {
			const source = await seedSocialMedia(tx);
			const target = await seedSocialMedia(tx);
			const serviceBoth = await seedService(tx);
			const serviceSourceOnly = await seedService(tx);

			await tx.insert(schema.servicesToSocialMedia).values([
				{ serviceId: serviceBoth, socialMediaId: source },
				{ serviceId: serviceBoth, socialMediaId: target },
				{ serviceId: serviceSourceOnly, socialMediaId: source },
			]);

			// Services reference social media just like units and projects do; a merge that forgot this
			// table would strand the source's rows and fail on the foreign key at the final delete.
			await mergeSocialMedia(tx, source, target);

			const rows = await tx
				.select({ serviceId: schema.servicesToSocialMedia.serviceId })
				.from(schema.servicesToSocialMedia)
				.where(eq(schema.servicesToSocialMedia.socialMediaId, target));

			expect(rows.map((row) => row.serviceId).toSorted()).toStrictEqual(
				[serviceBoth, serviceSourceOnly].toSorted(),
			);
			expect(await tx.query.socialMedia.findFirst({ where: { id: source } })).toBeUndefined();
		});
	});

	it("aborts without deleting anything when both accounts hold the same KPI in one report", async () => {
		await withTransaction(async (tx) => {
			const source = await seedSocialMedia(tx);
			const target = await seedSocialMedia(tx);
			const report = await seedCountryReport(tx);

			await tx.insert(schema.countryReportSocialMediaKpis).values([
				{ countryReportId: report, socialMediaId: source, kpi: "followers", value: 10 },
				{ countryReportId: report, socialMediaId: target, kpi: "followers", value: 20 },
			]);

			await expect(mergeSocialMedia(tx, source, target)).rejects.toThrow(
				"social-media-kpi-conflict",
			);

			expect(await tx.query.socialMedia.findFirst({ where: { id: source } })).toBeDefined();
		});
	});

	it("moves KPIs across when the report records a different category for each account", async () => {
		await withTransaction(async (tx) => {
			const source = await seedSocialMedia(tx);
			const target = await seedSocialMedia(tx);
			const report = await seedCountryReport(tx);

			await tx.insert(schema.countryReportSocialMediaKpis).values([
				{ countryReportId: report, socialMediaId: source, kpi: "followers", value: 10 },
				{ countryReportId: report, socialMediaId: target, kpi: "posts", value: 20 },
			]);

			await mergeSocialMedia(tx, source, target);

			// The categories do not collide, so the source's value must survive on the target rather
			// than be dropped as a duplicate of "some row this report already had".
			const kpis = await tx
				.select({
					kpi: schema.countryReportSocialMediaKpis.kpi,
					value: schema.countryReportSocialMediaKpis.value,
				})
				.from(schema.countryReportSocialMediaKpis)
				.where(eq(schema.countryReportSocialMediaKpis.socialMediaId, target))
				.orderBy(schema.countryReportSocialMediaKpis.kpi);

			expect(kpis).toStrictEqual([
				{ kpi: "followers", value: 10 },
				{ kpi: "posts", value: 20 },
			]);
		});
	});

	it("dedupes report links so a report that listed both accounts keeps one", async () => {
		await withTransaction(async (tx) => {
			const source = await seedSocialMedia(tx);
			const target = await seedSocialMedia(tx);
			const report = await seedCountryReport(tx);

			await tx.insert(schema.countryReportSocialMedia).values([
				{ countryReportId: report, socialMediaId: source },
				{ countryReportId: report, socialMediaId: target },
			]);

			await mergeSocialMedia(tx, source, target);

			const links = await tx
				.select({ n: sql<number>`count(*)::int` })
				.from(schema.countryReportSocialMedia)
				.where(eq(schema.countryReportSocialMedia.countryReportId, report))
				.then((rows) => rows[0]?.n ?? 0);

			expect(links).toBe(1);
		});
	});
});
