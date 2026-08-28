import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { createDraftDocument, publishVersion } from "@/lib/data/entity-lifecycle";
import { newsLifecycleAdapter } from "@/lib/data/news.lifecycle-adapter";
import { projectsLifecycleAdapter } from "@/lib/data/projects.lifecycle-adapter";
import { getEntityRelationOptions } from "@/lib/data/relations";
import type { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { withTransaction } from "@/test/lib/with-transaction";

type Tx = Awaited<Parameters<Parameters<typeof db.transaction>[0]>[0]>;

/**
 * Seed a published entity with a hyphenated slug and label (mirroring the real "CLARIN-ERIC"), so
 * the relation-options search can be exercised end-to-end. Uses the news type as a simple carrier —
 * the search only looks at the slug/label, not the subtype.
 */
async function seedPublishedEntity(tx: Tx, slug: string, label: string): Promise<string> {
	const type = await tx.query.entityTypes.findFirst({
		where: { type: "news" },
		columns: { id: true },
	});
	assert(type, "news entity type not found in database");
	const asset = await tx.query.assets.findFirst({ columns: { id: true } });
	assert(asset, "no asset found in database — seed one first");

	const { documentId, versionId } = await createDraftDocument(tx, type.id, slug);
	await tx.insert(schema.news).values({
		id: versionId,
		title: label,
		summary: f.lorem.paragraph(),
		publicationDate: new Date("2025-01-15T00:00:00.000Z"),
		imageId: asset.id,
	});
	await tx.update(schema.entities).set({ label }).where(eq(schema.entities.id, documentId));
	await publishVersion(tx, documentId, newsLifecycleAdapter);

	return documentId;
}

async function seedPublishedProject(
	tx: Tx,
	slug: string,
	name: string,
	acronym: string,
): Promise<string> {
	const type = await tx.query.entityTypes.findFirst({
		where: { type: "projects" },
		columns: { id: true },
	});
	assert(type, "projects entity type not found in database");
	const scope = await tx.query.projectScopes.findFirst({ columns: { id: true } });
	assert(scope, "project scope not found in database");

	const { documentId, versionId } = await createDraftDocument(tx, type.id, slug);
	await tx.insert(schema.projects).values({
		acronym,
		duration: { start: new Date("2026-01-01T00:00:00.000Z") },
		id: versionId,
		name,
		scopeId: scope.id,
	});
	await publishVersion(tx, documentId, projectsLifecycleAdapter);

	return documentId;
}

describe("getEntityRelationOptions search", () => {
	// A distinctive slug/label so the assertions can't collide with real seed data.
	const suffix = f.string.alphanumeric(8).toLowerCase();
	const slug = `clarin-eric-${suffix}`;
	const label = `CLARIN-ERIC ${suffix}`;

	it("matches a hyphenated slug when the query separates terms with spaces", async () => {
		await withTransaction(async (tx) => {
			const documentId = await seedPublishedEntity(tx, slug, label);

			const { items } = await getEntityRelationOptions({ q: `clarin eric ${suffix}` }, tx);

			expect(items.map((item) => item.id)).toContain(documentId);
		});
	});

	it("still matches the exact hyphenated query", async () => {
		await withTransaction(async (tx) => {
			const documentId = await seedPublishedEntity(tx, slug, label);

			const { items } = await getEntityRelationOptions({ q: `clarin-eric-${suffix}` }, tx);

			expect(items.map((item) => item.id)).toContain(documentId);
		});
	});

	it("is order-independent across terms", async () => {
		await withTransaction(async (tx) => {
			const documentId = await seedPublishedEntity(tx, slug, label);

			const { items } = await getEntityRelationOptions({ q: `${suffix} eric clarin` }, tx);

			expect(items.map((item) => item.id)).toContain(documentId);
		});
	});

	it("requires every term to match, not just one (AND, not OR)", async () => {
		await withTransaction(async (tx) => {
			const documentId = await seedPublishedEntity(tx, slug, label);

			// The first term matches, but "zzznotpresent" matches neither slug nor label, so the AND
			// across terms must exclude the entity.
			const { items } = await getEntityRelationOptions({ q: `${suffix} zzznotpresent` }, tx);

			expect(items.map((item) => item.id)).not.toContain(documentId);
		});
	});

	it("ignores punctuation differences between the query and the label", async () => {
		await withTransaction(async (tx) => {
			const ministrySlug = `ministry-culture-${suffix}`;
			const ministryLabel = `Ministry of Culture, Innovation and Higher Education ${suffix}`;
			const documentId = await seedPublishedEntity(tx, ministrySlug, ministryLabel);

			// The stored label has a comma the user did not type; each term still matches once
			// punctuation is normalized to spaces on both sides.
			const { items } = await getEntityRelationOptions({ q: `Culture Innovation ${suffix}` }, tx);

			expect(items.map((item) => item.id)).toContain(documentId);
		});
	});

	it('treats "&" and "and" as interchangeable', async () => {
		await withTransaction(async (tx) => {
			const rndSlug = `research-development-${suffix}`;
			const rndLabel = `R&D Foundation ${suffix}`;
			const documentId = await seedPublishedEntity(tx, rndSlug, rndLabel);

			// "R and D" must find the stored "R&D": "&" normalizes to " and " on the column side.
			const { items } = await getEntityRelationOptions({ q: `R and D ${suffix}` }, tx);

			expect(items.map((item) => item.id)).toContain(documentId);
		});
	});

	it("finds and displays a project by the acronym in its denormalized label", async () => {
		await withTransaction(async (tx) => {
			const acronym = `ACR${f.string.alpha(6).toUpperCase()}`;
			const name = `Acronym Search Project ${suffix}`;
			const documentId = await seedPublishedProject(tx, `acronym-project-${suffix}`, name, acronym);

			const { items } = await getEntityRelationOptions({ q: acronym }, tx);

			expect(items).toContainEqual(
				expect.objectContaining({ id: documentId, name: `${name} (${acronym})` }),
			);
		});
	});
});
