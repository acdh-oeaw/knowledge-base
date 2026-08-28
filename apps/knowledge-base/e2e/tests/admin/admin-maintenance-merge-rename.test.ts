import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { expect, test } from "@/e2e/lib/test";

const MAINTENANCE_PATH = "/en/dashboard/administrator/maintenance";
const WORKER_PREFIX = () => `[e2e-worker-${String(test.info().workerIndex)}]`;

/** Open the maintenance dashboard and switch to the "Merge, duplicate & rename" top-level tab. */
async function gotoMergeAndRename(page: Page): Promise<void> {
	await page.goto(MAINTENANCE_PATH);
	await page.getByRole("tab", { name: "Merge, duplicate & rename" }).click();
}

/** Pick an option in one of the maintenance AsyncSelect pickers, identified by its trigger label. */
async function pickEntity(
	page: Page,
	triggerName: string | RegExp,
	query: string,
	optionName: string,
): Promise<void> {
	await page.getByRole("button", { name: triggerName }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByRole("searchbox").fill(query);
	const option = dialog.getByRole("option", { name: optionName, exact: true });
	await option.waitFor({ state: "visible" });
	await option.click();
	// Wait for the popover to close before returning, so a subsequent pickEntity call does not
	// find this (still-closing) dialog alongside the next one and trip strict-mode on `searchbox`.
	await dialog.waitFor({ state: "hidden" });
}

test.describe("admin – maintenance merge & rename", () => {
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerNewsItems(testInfo.workerIndex);
		await db.cleanupWorkerSocialMedia(testInfo.workerIndex);
		await db.cleanupWorkerServices(testInfo.workerIndex);
	});

	test("merges a duplicate into a canonical entity, re-pointing relations and deleting the source", async ({
		page,
		db,
	}) => {
		const asset = await db.getTestAsset();
		const relationTarget = await db.getTestEntity();

		const suffix = randomUUID();
		const sourceTitle = `${WORKER_PREFIX()} Merge Source ${suffix}`;
		const targetTitle = `${WORKER_PREFIX()} Merge Target ${suffix}`;

		const source = await db.createCollidingPublishedNewsDocument({
			slug: `merge-source-${suffix}`,
			title: sourceTitle,
			imageId: asset.id,
		});
		const target = await db.createCollidingPublishedNewsDocument({
			slug: `merge-target-${suffix}`,
			title: targetTitle,
			imageId: asset.id,
		});

		// Give the source a relation that the merge must re-point onto the target.
		await db.addEntityToEntityRelation(source.documentId, relationTarget.id);

		await gotoMergeAndRename(page);

		await pickEntity(page, "Search for the duplicate entity…", sourceTitle, sourceTitle);
		await pickEntity(page, "Search for the canonical entity…", targetTitle, targetTitle);

		await page.getByRole("button", { name: "Merge entities" }).click();

		const modal = page.getByRole("dialog", { name: "Merge entities" });
		await modal.getByRole("textbox", { name: /Type MERGE to confirm/ }).fill("MERGE");
		await modal.getByRole("button", { name: "Merge and delete source" }).click();

		await expect(page.getByText(/Merged .* into /)).toBeVisible();

		// Source document is gone; its relation now belongs to the target.
		expect(await db.entityDocumentExists(source.documentId)).toBe(false);

		const targetRelations = await db.getEntityRelations(target.documentId);
		expect(targetRelations.relatedEntityIds).toContain(relationTarget.id);
	});

	test("merges a duplicate social-media account into the canonical one, deleting the source", async ({
		page,
		db,
	}) => {
		const suffix = randomUUID();
		const sourceName = `${WORKER_PREFIX()} SM Source ${suffix}`;
		const targetName = `${WORKER_PREFIX()} SM Target ${suffix}`;

		await db.createSocialMedia({
			name: sourceName,
			type: "bluesky",
			url: `https://example.com/sm-source-${suffix}`,
		});
		await db.createSocialMedia({
			name: targetName,
			type: "bluesky",
			url: `https://example.com/sm-target-${suffix}`,
		});

		await gotoMergeAndRename(page);
		await page.getByRole("tab", { name: "Merge social media" }).click();

		await pickEntity(page, "Search for the duplicate account…", sourceName, sourceName);
		await pickEntity(page, "Search for the canonical account…", targetName, targetName);

		await page.getByRole("button", { name: "Merge accounts" }).click();

		const modal = page.getByRole("dialog", { name: "Merge social-media accounts" });
		await modal.getByRole("textbox", { name: /Type MERGE to confirm/ }).fill("MERGE");
		await modal.getByRole("button", { name: "Merge and delete source" }).click();

		await expect(page.getByText(/Merged .* into /)).toBeVisible();

		expect(await db.getSocialMediaByName(sourceName)).toBeNull();
		expect(await db.getSocialMediaByName(targetName)).not.toBeNull();
	});

	test("merges a service the marketplace no longer lists into the canonical one", async ({
		page,
		db,
	}) => {
		const suffix = randomUUID();
		const sourceName = `${WORKER_PREFIX()} Service Source ${suffix}`;
		const targetName = `${WORKER_PREFIX()} Service Target ${suffix}`;

		// "needs_review" is the status the SSHOC ingest sets once the marketplace stops returning a
		// service — exactly the case merging exists for.
		await db.createService({ name: sourceName, status: "needs_review" });
		await db.createService({ name: targetName, status: "live" });

		await gotoMergeAndRename(page);
		await page.getByRole("tab", { name: "Merge services" }).click();

		await pickEntity(page, "Search for the duplicate service…", sourceName, sourceName);
		await pickEntity(page, "Search for the canonical service…", targetName, targetName);

		await page.getByRole("button", { name: "Merge services" }).click();

		const modal = page.getByRole("dialog", { name: "Merge duplicate services" });
		await modal.getByRole("textbox", { name: /Type MERGE to confirm/ }).fill("MERGE");
		await modal.getByRole("button", { name: "Merge and delete source" }).click();

		await expect(page.getByText(/Merged .* into /)).toBeVisible();

		expect(await db.getServiceByName(sourceName)).toBeNull();
		expect(await db.getServiceByName(targetName)).not.toBeNull();
	});

	test("duplicates an entity into a draft copy, carrying relations but not publishing it", async ({
		page,
		db,
	}) => {
		const asset = await db.getTestAsset();
		const relationTarget = await db.getTestEntity();

		const suffix = randomUUID();
		const sourceTitle = `${WORKER_PREFIX()} Duplicate Source ${suffix}`;
		const sourceSlug = `duplicate-source-${suffix}`;

		const source = await db.createCollidingPublishedNewsDocument({
			slug: sourceSlug,
			title: sourceTitle,
			imageId: asset.id,
		});

		// Give the source a relation the copy must inherit.
		await db.addEntityToEntityRelation(source.documentId, relationTarget.id);

		await gotoMergeAndRename(page);
		await page.getByRole("tab", { name: "Duplicate entity" }).click();

		await pickEntity(page, "Search for the entity to duplicate…", sourceTitle, sourceTitle);

		// The slug field prefills with the provisional `-copy`; name the copy instead.
		const slugField = page.getByRole("textbox", { name: "Slug for the copy" });
		await expect(slugField).toHaveValue(`${sourceSlug}-copy`);
		const cloneSlug = `duplicate-clone-${suffix}`;
		await slugField.fill(cloneSlug);

		await page.getByRole("button", { name: "Duplicate entity" }).click();

		await expect(page.getByText(/Created a draft copy of/)).toBeVisible();

		// The copy exists under the requested slug, as a draft only — never published.
		const clone = await db.getEntityDocumentBySlug(cloneSlug);
		expect(clone).not.toBeNull();
		expect(clone?.hasDraft).toBe(true);
		expect(clone?.hasPublished).toBe(false);

		// It inherited the source's relation, and the source kept its own.
		const cloneRelations = await db.getEntityRelations(clone!.documentId);
		expect(cloneRelations.relatedEntityIds).toContain(relationTarget.id);

		const sourceRelations = await db.getEntityRelations(source.documentId);
		expect(sourceRelations.relatedEntityIds).toContain(relationTarget.id);
		expect(await db.entityDocumentExists(source.documentId)).toBe(true);
	});

	test("edits the slug of a never-published draft, which the relation pickers cannot see", async ({
		page,
		db,
	}) => {
		const asset = await db.getTestAsset();
		const suffix = randomUUID();
		const draftTitle = `${WORKER_PREFIX()} Draft Only ${suffix}`;

		const draft = await db.createDraftNewsDocument({
			slug: `draft-only-${suffix}`,
			title: draftTitle,
			imageId: asset.id,
		});

		await gotoMergeAndRename(page);
		await page.getByRole("tab", { name: "Edit slug" }).click();

		// Found by title even though `entities.label` is null until first publish, and badged as a draft.
		await pickEntity(page, "Search for an entity…", draftTitle, draftTitle);
		await expect(page.getByText("This entity has never been published")).toBeVisible();

		const newSlug = `draft-renamed-${suffix}`;
		await page.getByRole("textbox", { name: "New slug" }).fill(newSlug);
		await page.getByRole("button", { name: "Update slug" }).click();

		await expect(page.getByText("Slug updated.")).toBeVisible();
		expect(await db.getEntitySlugByDocumentId(draft.documentId)).toBe(newSlug);
	});

	test("edits an entity slug, and rejects a colliding slug with a friendly error", async ({
		page,
		db,
	}) => {
		const asset = await db.getTestAsset();
		const suffix = randomUUID();

		const subject = await db.createCollidingPublishedNewsDocument({
			slug: `slug-subject-${suffix}`,
			title: `${WORKER_PREFIX()} Slug Subject ${suffix}`,
			imageId: asset.id,
		});
		const other = await db.createCollidingPublishedNewsDocument({
			slug: `slug-other-${suffix}`,
			title: `${WORKER_PREFIX()} Slug Other ${suffix}`,
			imageId: asset.id,
		});
		const subjectTitle = `${WORKER_PREFIX()} Slug Subject ${suffix}`;

		await page.goto(MAINTENANCE_PATH);
		await page.getByRole("tab", { name: "Merge, duplicate & rename" }).click();
		await page.getByRole("tab", { name: "Edit slug" }).click();

		// Happy path: rename to a fresh, unique slug.
		const newSlug = `slug-renamed-${suffix}`;
		await pickEntity(page, "Search for an entity…", subjectTitle, subjectTitle);
		await page.getByRole("textbox", { name: "New slug" }).fill(newSlug);
		await page.getByRole("button", { name: "Update slug" }).click();

		await expect(page.getByText("Slug updated.")).toBeVisible();
		expect(await db.getEntitySlugByDocumentId(subject.documentId)).toBe(newSlug);

		// Collision: rename to the other document's slug → friendly error, slug unchanged.
		const otherSlug = await db.getEntitySlugByDocumentId(other.documentId);
		expect(otherSlug).not.toBeNull();
		await page.getByRole("textbox", { name: "New slug" }).fill(otherSlug!);
		await page.getByRole("button", { name: "Update slug" }).click();

		await expect(page.getByText("An entity with this slug already exists.")).toBeVisible();
		expect(await db.getEntitySlugByDocumentId(subject.documentId)).toBe(newSlug);
	});
});
