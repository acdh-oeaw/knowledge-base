import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { describe, expect, it } from "vitest";

import { documentationPagesLifecycleAdapter } from "@/lib/data/documentation-pages.lifecycle-adapter";
import { documentsPoliciesLifecycleAdapter } from "@/lib/data/documents-policies.lifecycle-adapter";
import {
	type EntityLifecycleAdapter,
	createDraftDocument,
	publishVersion,
	subtypePayload,
} from "@/lib/data/entity-lifecycle";
import { eventsLifecycleAdapter } from "@/lib/data/events.lifecycle-adapter";
import { fundingCallsLifecycleAdapter } from "@/lib/data/funding-calls.lifecycle-adapter";
import { impactCaseStudiesLifecycleAdapter } from "@/lib/data/impact-case-studies.lifecycle-adapter";
import { internalPagesLifecycleAdapter } from "@/lib/data/internal-pages.lifecycle-adapter";
import { newsLifecycleAdapter } from "@/lib/data/news.lifecycle-adapter";
import { opportunitiesLifecycleAdapter } from "@/lib/data/opportunities.lifecycle-adapter";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { pagesLifecycleAdapter } from "@/lib/data/pages.lifecycle-adapter";
import { personsLifecycleAdapter } from "@/lib/data/persons.lifecycle-adapter";
import { projectsLifecycleAdapter } from "@/lib/data/projects.lifecycle-adapter";
import { spotlightArticlesLifecycleAdapter } from "@/lib/data/spotlight-articles.lifecycle-adapter";
import type { Transaction } from "@/lib/db";
import { type PgTable, eq, getColumns } from "@/lib/db/sql";
import { withTransaction } from "@/test/lib/with-transaction";

// ---------------------------------------------------------------------------
// Foreign-key reference rows shared by the seed payloads
// ---------------------------------------------------------------------------

interface Refs {
	assetId: string;
	organisationalUnitTypeId: string;
	projectScopeId: string;
	opportunitySourceId: string;
	documentPolicyGroupId: string;
	personSocialMediaTypeId: string;
}

async function resolveRefs(tx: Transaction): Promise<Refs> {
	const [asset] = await tx.select({ id: schema.assets.id }).from(schema.assets).limit(1);
	assert(asset, "No asset found in database — seed one first.");

	const [organisationalUnitType] = await tx
		.select({ id: schema.organisationalUnitTypes.id })
		.from(schema.organisationalUnitTypes)
		.limit(1);
	assert(organisationalUnitType, "No organisational unit type found — seed lookup data first.");

	const [projectScope] = await tx
		.select({ id: schema.projectScopes.id })
		.from(schema.projectScopes)
		.limit(1);
	assert(projectScope, "No project scope found — seed lookup data first.");

	const [opportunitySource] = await tx
		.select({ id: schema.opportunitySources.id })
		.from(schema.opportunitySources)
		.limit(1);
	assert(opportunitySource, "No opportunity source found — seed lookup data first.");

	const [documentPolicyGroup] = await tx
		.insert(schema.documentPolicyGroups)
		.values({ label: `roundtrip-${f.string.uuid()}`, position: 1 })
		.returning({ id: schema.documentPolicyGroups.id });
	assert(documentPolicyGroup);

	const [personSocialMediaType] = await tx
		.select({ id: schema.personSocialMediaTypes.id })
		.from(schema.personSocialMediaTypes)
		.limit(1);
	assert(personSocialMediaType, "No person social media type found — seed lookup data first.");

	return {
		assetId: asset.id,
		organisationalUnitTypeId: organisationalUnitType.id,
		projectScopeId: projectScope.id,
		opportunitySourceId: opportunitySource.id,
		documentPolicyGroupId: documentPolicyGroup.id,
		personSocialMediaTypeId: personSocialMediaType.id,
	};
}

// ---------------------------------------------------------------------------
// Per-adapter test cases
// ---------------------------------------------------------------------------

/**
 * Each case seeds a source subtype row with _every_ copyable column set to a distinct, non-default
 * value, publishes (exercising `cloneSubtype`) and republishes (exercising `replaceSubtype` /
 * `wipeSubtype`+`cloneSubtype`), then asserts the published row still deep-equals the source. If
 * any adapter drops a column, the published value diverges and the test fails — the assertion that
 * would have caught the original `organisational_units.email` / `mailing_list` regression.
 */
interface RoundtripCase {
	entityType: (typeof schema.entityTypesEnum)[number];
	table: PgTable;
	adapter: EntityLifecycleAdapter;
	/** Insert the source subtype row and return the copyable payload that was written. */
	seed: (tx: Transaction, versionId: string, refs: Refs) => Promise<Record<string, unknown>>;
	/** Read the subtype row for a version, stripped to its copyable columns. */
	read: (tx: Transaction, versionId: string) => Promise<Record<string, unknown> | undefined>;
	/**
	 * Adapters that own version-scoped child rows (rather than just the subtype row) copy those in
	 * `cloneSubtype` too, so they get their own seed/read pair. Unlike the subtype row there is no
	 * column-coverage assertion for children — `readChildren` decides what "carried forward" means.
	 */
	seedChildren?: (tx: Transaction, versionId: string, refs: Refs) => Promise<unknown>;
	readChildren?: (tx: Transaction, versionId: string) => Promise<unknown>;
}

const duration = {
	start: new Date("2026-01-01T00:00:00.000Z"),
	end: new Date("2026-12-31T00:00:00.000Z"),
};
const publicationDate = new Date("2026-03-15T00:00:00.000Z");

/**
 * A featured image's caption choice, seeded to non-default values so the copy assertions actually
 * exercise both columns: `override` is the one mode that also gives `imageCaption` meaning.
 */
const imageCaption = {
	type: "doc",
	content: [{ type: "paragraph", content: [{ type: "text", text: "Photo: Jane Doe" }] }],
};

const cases: Array<RoundtripCase> = [
	{
		entityType: "documentation_pages",
		table: schema.documentationPages,
		adapter: documentationPagesLifecycleAdapter,
		async seed(tx, versionId) {
			const values = { title: f.lorem.sentence() };
			await tx.insert(schema.documentationPages).values({ id: versionId, ...values });
			return values;
		},
		async read(tx, versionId) {
			const [row] = await tx
				.select()
				.from(schema.documentationPages)
				.where(eq(schema.documentationPages.id, versionId))
				.limit(1);
			return row == null ? undefined : subtypePayload(row);
		},
	},
	{
		entityType: "internal_pages",
		table: schema.internalPages,
		adapter: internalPagesLifecycleAdapter,
		async seed(tx, versionId) {
			const values = { title: f.lorem.sentence() };
			await tx.insert(schema.internalPages).values({ id: versionId, ...values });
			return values;
		},
		async read(tx, versionId) {
			const [row] = await tx
				.select()
				.from(schema.internalPages)
				.where(eq(schema.internalPages.id, versionId))
				.limit(1);
			return row == null ? undefined : subtypePayload(row);
		},
	},
	{
		entityType: "news",
		table: schema.news,
		adapter: newsLifecycleAdapter,
		async seed(tx, versionId, refs) {
			const values = {
				title: f.lorem.sentence(),
				summary: f.lorem.paragraph(),
				publicationDate,
				imageId: refs.assetId,
				imageCaption,
				imageCaptionMode: "override" as const,
			};
			await tx.insert(schema.news).values({ id: versionId, ...values });
			return values;
		},
		async read(tx, versionId) {
			const [row] = await tx
				.select()
				.from(schema.news)
				.where(eq(schema.news.id, versionId))
				.limit(1);
			return row == null ? undefined : subtypePayload(row);
		},
	},
	{
		entityType: "pages",
		table: schema.pages,
		adapter: pagesLifecycleAdapter,
		async seed(tx, versionId, refs) {
			const values = {
				title: f.lorem.sentence(),
				summary: f.lorem.paragraph(),
				publicationDate,
				imageId: refs.assetId,
				imageCaption,
				imageCaptionMode: "override" as const,
			};
			await tx.insert(schema.pages).values({ id: versionId, ...values });
			return values;
		},
		async read(tx, versionId) {
			const [row] = await tx
				.select()
				.from(schema.pages)
				.where(eq(schema.pages.id, versionId))
				.limit(1);
			return row == null ? undefined : subtypePayload(row);
		},
	},
	{
		entityType: "spotlight_articles",
		table: schema.spotlightArticles,
		adapter: spotlightArticlesLifecycleAdapter,
		async seed(tx, versionId, refs) {
			const values = {
				title: f.lorem.sentence(),
				summary: f.lorem.paragraph(),
				publicationDate,
				imageId: refs.assetId,
				imageCaption,
				imageCaptionMode: "override" as const,
			};
			await tx.insert(schema.spotlightArticles).values({ id: versionId, ...values });
			return values;
		},
		async read(tx, versionId) {
			const [row] = await tx
				.select()
				.from(schema.spotlightArticles)
				.where(eq(schema.spotlightArticles.id, versionId))
				.limit(1);
			return row == null ? undefined : subtypePayload(row);
		},
	},
	{
		entityType: "impact_case_studies",
		table: schema.impactCaseStudies,
		adapter: impactCaseStudiesLifecycleAdapter,
		async seed(tx, versionId, refs) {
			const values = {
				title: f.lorem.sentence(),
				summary: f.lorem.paragraph(),
				publicationDate,
				imageId: refs.assetId,
				imageCaption,
				imageCaptionMode: "override" as const,
			};
			await tx.insert(schema.impactCaseStudies).values({ id: versionId, ...values });
			return values;
		},
		async read(tx, versionId) {
			const [row] = await tx
				.select()
				.from(schema.impactCaseStudies)
				.where(eq(schema.impactCaseStudies.id, versionId))
				.limit(1);
			return row == null ? undefined : subtypePayload(row);
		},
	},
	{
		entityType: "funding_calls",
		table: schema.fundingCalls,
		adapter: fundingCallsLifecycleAdapter,
		async seed(tx, versionId, refs) {
			const values = {
				title: f.lorem.sentence(),
				summary: f.lorem.paragraph(),
				duration,
				imageId: refs.assetId,
				imageCaption,
				imageCaptionMode: "override" as const,
			};
			await tx.insert(schema.fundingCalls).values({ id: versionId, ...values });
			return values;
		},
		async read(tx, versionId) {
			const [row] = await tx
				.select()
				.from(schema.fundingCalls)
				.where(eq(schema.fundingCalls.id, versionId))
				.limit(1);
			return row == null ? undefined : subtypePayload(row);
		},
	},
	{
		entityType: "events",
		table: schema.events,
		adapter: eventsLifecycleAdapter,
		async seed(tx, versionId, refs) {
			const values = {
				title: f.lorem.sentence(),
				summary: f.lorem.paragraph(),
				imageId: refs.assetId,
				imageCaption,
				imageCaptionMode: "override" as const,
				location: f.location.city(),
				duration,
				isFullDay: true,
				website: f.internet.url(),
			};
			await tx.insert(schema.events).values({ id: versionId, ...values });
			return values;
		},
		async read(tx, versionId) {
			const [row] = await tx
				.select()
				.from(schema.events)
				.where(eq(schema.events.id, versionId))
				.limit(1);
			return row == null ? undefined : subtypePayload(row);
		},
	},
	{
		entityType: "opportunities",
		table: schema.opportunities,
		adapter: opportunitiesLifecycleAdapter,
		async seed(tx, versionId, refs) {
			const values = {
				title: f.lorem.sentence(),
				summary: f.lorem.paragraph(),
				duration,
				sourceId: refs.opportunitySourceId,
				website: f.internet.url(),
				imageId: refs.assetId,
				imageCaption,
				imageCaptionMode: "override" as const,
			};
			await tx.insert(schema.opportunities).values({ id: versionId, ...values });
			return values;
		},
		async read(tx, versionId) {
			const [row] = await tx
				.select()
				.from(schema.opportunities)
				.where(eq(schema.opportunities.id, versionId))
				.limit(1);
			return row == null ? undefined : subtypePayload(row);
		},
	},
	{
		entityType: "documents_policies",
		table: schema.documentsPolicies,
		adapter: documentsPoliciesLifecycleAdapter,
		async seed(tx, versionId, refs) {
			const values = {
				title: f.lorem.sentence(),
				summary: f.lorem.paragraph(),
				url: f.internet.url(),
				documentId: refs.assetId,
				groupId: refs.documentPolicyGroupId,
				position: 42,
			};
			await tx.insert(schema.documentsPolicies).values({ id: versionId, ...values });
			return values;
		},
		async read(tx, versionId) {
			const [row] = await tx
				.select()
				.from(schema.documentsPolicies)
				.where(eq(schema.documentsPolicies.id, versionId))
				.limit(1);
			return row == null ? undefined : subtypePayload(row);
		},
	},
	{
		entityType: "persons",
		table: schema.persons,
		adapter: personsLifecycleAdapter,
		async seed(tx, versionId, refs) {
			const values = {
				name: f.person.fullName(),
				sortName: f.person.lastName(),
				email: f.internet.email(),
				orcid: "0000-0002-1825-0097",
				imageId: refs.assetId,
				imageCaption,
				imageCaptionMode: "override" as const,
			};
			await tx.insert(schema.persons).values({ id: versionId, ...values });
			return values;
		},
		async read(tx, versionId) {
			const [row] = await tx
				.select()
				.from(schema.persons)
				.where(eq(schema.persons.id, versionId))
				.limit(1);
			return row == null ? undefined : subtypePayload(row);
		},
		async seedChildren(tx, versionId, refs) {
			const values = [
				{
					typeId: refs.personSocialMediaTypeId,
					url: f.internet.url(),
					label: f.internet.username(),
					position: 0,
				},
				{ typeId: refs.personSocialMediaTypeId, url: f.internet.url(), label: null, position: 1 },
			];
			await tx.insert(schema.personSocialMedia).values(
				values.map((value) => {
					return { personId: versionId, ...value };
				}),
			);
			return values;
		},
		async readChildren(tx, versionId) {
			return tx
				.select({
					typeId: schema.personSocialMedia.typeId,
					url: schema.personSocialMedia.url,
					label: schema.personSocialMedia.label,
					position: schema.personSocialMedia.position,
				})
				.from(schema.personSocialMedia)
				.where(eq(schema.personSocialMedia.personId, versionId))
				.orderBy(schema.personSocialMedia.position);
		},
	},
	{
		entityType: "organisational_units",
		table: schema.organisationalUnits,
		adapter: organisationalUnitsLifecycleAdapter,
		async seed(tx, versionId, refs) {
			const values = {
				metadata: { note: f.lorem.words(3) },
				name: f.company.name(),
				acronym: f.string.alpha(4),
				ror: f.internet.url(),
				summary: f.lorem.paragraph(),
				email: f.internet.email(),
				mailingList: f.internet.email(),
				imageId: refs.assetId,
				typeId: refs.organisationalUnitTypeId,
				sshocMarketplaceActorId: f.number.int({ min: 1, max: 100000 }),
			};
			await tx.insert(schema.organisationalUnits).values({ id: versionId, ...values });
			return values;
		},
		async read(tx, versionId) {
			const [row] = await tx
				.select()
				.from(schema.organisationalUnits)
				.where(eq(schema.organisationalUnits.id, versionId))
				.limit(1);
			return row == null ? undefined : subtypePayload(row);
		},
	},
	{
		entityType: "projects",
		table: schema.projects,
		adapter: projectsLifecycleAdapter,
		async seed(tx, versionId, refs) {
			const values = {
				metadata: { note: f.lorem.words(3) },
				name: f.company.name(),
				acronym: f.string.alpha(4),
				duration,
				funding: 123456.78,
				summary: f.lorem.paragraph(),
				call: f.lorem.words(2),
				topic: f.lorem.words(2),
				imageId: refs.assetId,
				scopeId: refs.projectScopeId,
			};
			await tx.insert(schema.projects).values({ id: versionId, ...values });
			return values;
		},
		async read(tx, versionId) {
			const [row] = await tx
				.select()
				.from(schema.projects)
				.where(eq(schema.projects.id, versionId))
				.limit(1);
			return row == null ? undefined : subtypePayload(row);
		},
	},
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function copyableColumnNames(table: PgTable): Array<string> {
	return Object.keys(getColumns(table))
		.filter((name) => name !== "id" && name !== "createdAt" && name !== "updatedAt")
		.toSorted();
}

describe("lifecycle adapter version copy round-trip", () => {
	for (const testCase of cases) {
		it(`${testCase.entityType}: copies every subtype column forward on publish and republish`, async () => {
			await withTransaction(async (tx) => {
				const refs = await resolveRefs(tx);

				const entityType = await tx.query.entityTypes.findFirst({
					where: { type: testCase.entityType },
					columns: { id: true },
				});
				assert(entityType, `entity type "${testCase.entityType}" not found in database`);

				const slug = slugify(`${testCase.entityType}-${f.string.uuid()}`);
				const { documentId, versionId } = await createDraftDocument(tx, entityType.id, slug);

				const written = await testCase.seed(tx, versionId, refs);

				// The seed must set every copyable column, so a newly added column is always exercised by
				// the copy assertions below (and never silently skipped).
				expect(Object.keys(written).toSorted()).toEqual(copyableColumnNames(testCase.table));

				const writtenChildren = await testCase.seedChildren?.(tx, versionId, refs);

				// First publish: no published version yet → cloneSubtype.
				const publishedId = await publishVersion(tx, documentId, testCase.adapter);
				expect(await testCase.read(tx, publishedId)).toEqual(written);
				if (testCase.readChildren != null) {
					expect(await testCase.readChildren(tx, publishedId)).toEqual(writtenChildren);
				}

				// Republish: published version already exists → replaceSubtype (or wipeSubtype+cloneSubtype).
				const republishedId = await publishVersion(tx, documentId, testCase.adapter);
				expect(republishedId).toBe(publishedId);
				expect(await testCase.read(tx, republishedId)).toEqual(written);
				if (testCase.readChildren != null) {
					// Republishing must not leave the previous copy behind alongside the new one.
					expect(await testCase.readChildren(tx, republishedId)).toEqual(writtenChildren);
				}
			});
		});
	}
});
