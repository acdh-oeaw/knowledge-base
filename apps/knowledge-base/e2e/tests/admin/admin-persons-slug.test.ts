import { randomUUID } from "node:crypto";

import slugify from "@sindresorhus/slugify";

import { expect, test } from "@/e2e/lib/test";

/**
 * End-to-end coverage for the entity-slug UX: derived slugs deduplicate so a duplicate title never
 * dead-ends creation, an explicit slug is honoured but a colliding one is rejected, a draft's slug
 * is freely renameable, and a published slug is frozen — enforced on the server, not just hidden in
 * the form. Persons are the carrier; the slug plumbing is shared across all entity types.
 */
test.describe("persons admin — slug", () => {
	/** Run sequentially within this file; data is isolated per Playwright worker index. */
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		await db.getTestAsset();
	});

	test.afterAll(async ({ db }, testInfo) => {
		// Some cases publish, producing multi-version documents, so clean up at document granularity.
		await db.cleanupWorkerPersonsLifecycleItems(testInfo.workerIndex);
	});

	test("derives a unique slug from the title and deduplicates a colliding one", async ({
		createAdminPersonsPage,
		db,
	}) => {
		const personsPage = createAdminPersonsPage(test.info().workerIndex);

		// Both persons share a name, so both derive the same base slug — the exact case that used to
		// fail creation with "an entity with this slug already exists".
		const name = `${personsPage.workerPrefix} Slug Dedupe ${randomUUID()}`;
		const baseSlug = slugify(name);

		await personsPage.gotoCreate();
		await personsPage.fillName(name);
		await personsPage.fillSortName("Dedupe, First");
		const firstSlug = await personsPage.submitCreateReturningSlug();

		await personsPage.gotoCreate();
		await personsPage.fillName(name);
		await personsPage.fillSortName("Dedupe, Second");
		const secondSlug = await personsPage.submitCreateReturningSlug();

		// The redirect URLs are the assertion: the second lands on its own `-2` details page rather
		// than the first person's, proving the redirect follows the stored slug.
		expect(firstSlug).toBe(baseSlug);
		expect(secondSlug).toBe(`${baseSlug}-2`);

		expect(await db.getEntityDocumentBySlug(baseSlug)).not.toBeNull();
		expect(await db.getEntityDocumentBySlug(`${baseSlug}-2`)).not.toBeNull();
	});

	test("honours an explicit slug and rejects a colliding one with a friendly error", async ({
		createAdminPersonsPage,
		db,
		page,
	}) => {
		const personsPage = createAdminPersonsPage(test.info().workerIndex);
		const suffix = randomUUID();
		const collisionName = `${personsPage.workerPrefix} Explicit Collision ${suffix}`;

		// A chosen slug is stored normalised — the field accepts what a user naturally types and stores
		// what a URL needs.
		const typedSlug = `Chosen Slug ${suffix}`;
		await personsPage.gotoCreate();
		await personsPage.fillName(`${personsPage.workerPrefix} Explicit Slug ${suffix}`);
		await personsPage.fillSortName("Explicit, Slug");
		await personsPage.fillSlug(typedSlug);
		const storedSlug = await personsPage.submitCreateReturningSlug();
		expect(storedSlug).toBe(slugify(typedSlug));

		// A second person asking for that exact slug must fail loudly, not silently become `-2`.
		await personsPage.gotoCreate();
		await personsPage.fillName(collisionName);
		await personsPage.fillSortName("Explicit, Collision");
		await personsPage.fillSlug(storedSlug);
		await personsPage.clickSaveDraft();

		await expect(page.getByText("An entity with this slug already exists.")).toBeVisible();
		// Still on the create form — no redirect happened.
		expect(new URL(page.url()).pathname).toMatch(/\/persons\/create$/);
		// The second person was never created.
		expect(await db.getPersonByName(collisionName)).toBeNull();
	});

	test("renames a draft slug", async ({ createAdminPersonsPage, db }) => {
		const personsPage = createAdminPersonsPage(test.info().workerIndex);
		const name = `${personsPage.workerPrefix} Draft Rename ${randomUUID()}`;

		await personsPage.gotoCreate();
		await personsPage.fillName(name);
		await personsPage.fillSortName("Rename, Draft");
		const originalSlug = await personsPage.submitCreateReturningSlug();

		// The create helper lands on the details page; the list helpers need the list page.
		await personsPage.goto();
		await personsPage.gotoEditFromList(name);

		// The draft is not public yet, so its slug is a plain editable field.
		await expect(personsPage.slugInput()).toBeEnabled();
		const renamedSlug = `${originalSlug}-renamed`;
		await personsPage.fillSlug(renamedSlug);
		await personsPage.submitForm();

		expect(await db.getEntityDocumentBySlug(renamedSlug)).not.toBeNull();
		expect(await db.getEntityDocumentBySlug(originalSlug)).toBeNull();
	});

	test("freezes a published slug and rejects a forged rename with a friendly error", async ({
		createAdminPersonsPage,
		db,
		page,
	}) => {
		const personsPage = createAdminPersonsPage(test.info().workerIndex);
		const name = `${personsPage.workerPrefix} Published Freeze ${randomUUID()}`;

		await personsPage.gotoCreate();
		await personsPage.fillName(name);
		await personsPage.fillSortName("Freeze, Published");
		const publishedSlug = await personsPage.submitCreateReturningSlug();

		// The create helper lands on the details page; the list helpers need the list page.
		await personsPage.goto();
		await personsPage.searchByName(name);
		await personsPage.gotoDetailsFromList(name);
		await personsPage.publishItem();

		// Reopen the edit form: the slug field is now disabled and points at the Maintenance page.
		await personsPage.gotoEditFromList(name);
		await expect(personsPage.slugInput()).toBeDisabled();

		// Forge a rename past the disabled field. The server must refuse it with a specific message,
		// not a generic 500, and the stored slug must be untouched.
		const forgedSlug = `${publishedSlug}-forged`;
		await personsPage.forgeSlugAndSaveDraft(forgedSlug);

		await expect(
			page.getByText(
				"This entity is published, so its address can only be changed by an administrator on the Maintenance page.",
			),
		).toBeVisible();
		expect(await db.getEntityDocumentBySlug(forgedSlug)).toBeNull();
		expect(await db.getEntityDocumentBySlug(publishedSlug)).not.toBeNull();
	});
});
