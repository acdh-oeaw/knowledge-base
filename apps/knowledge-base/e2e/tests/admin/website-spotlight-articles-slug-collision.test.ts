import { randomUUID } from "node:crypto";

import slugify from "@sindresorhus/slugify";

import { expect, test } from "@/e2e/lib/test";

/**
 * Regression test for the cross-type slug collision that 404'd spotlight details pages in prod.
 *
 * Slugs are unique only per `(entity type, slug)`, so two documents of different types can share a
 * slug. The details page used to resolve the slug against the bare `entities` table without scoping
 * to the spotlight type, so it could land on the other-type document and then fail to find a
 * matching spotlight version → `notFound()`. The fix resolves the slug through the spotlight
 * subtype (mirroring the edit page).
 */
test.describe("website spotlight articles — cross-type slug collision", () => {
	/** Run sequentially within this file; data is isolated per Playwright worker index. */
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		await db.getTestAsset();
	});

	test.afterAll(async ({ db }, testInfo) => {
		// The colliding document is a news item, so clean up both types by worker prefix.
		await db.cleanupWorkerSpotlightArticles(testInfo.workerIndex);
		await db.cleanupWorkerNewsItems(testInfo.workerIndex);
	});

	test("opens spotlight details when another entity type shares the slug", async ({
		createWebsiteSpotlightArticlesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const spotlightArticlesPage = createWebsiteSpotlightArticlesPage(workerIndex);

		const title = `${spotlightArticlesPage.workerPrefix} Slug Collision ${randomUUID()}`;
		// The create action derives the slug as `slugify(title)`; compute the same value here.
		const slug = slugify(title);
		const testAsset = await db.getTestAsset();

		// Insert the colliding (news) document BEFORE creating the spotlight article. Inserting it
		// first makes the buggy, unscoped `entities.findFirst({ where: { slug } })` resolve to the
		// wrong-type document — i.e. this test fails against the pre-fix code.
		await db.createCollidingPublishedNewsDocument({ slug, title, imageId: testAsset.id });

		// Create the spotlight article through the UI (its slug is derived from the title).
		await spotlightArticlesPage.gotoCreate();
		await spotlightArticlesPage.fillTitle(title);
		await spotlightArticlesPage.fillSummary("E2E slug collision spotlight article");
		await spotlightArticlesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightArticlesPage.submitForm();

		// Guard: confirm both documents really do collide on slug (fails loudly if slugify diverges).
		expect(await db.getSpotlightArticleSlugByTitle(title)).toBe(slug);

		// Navigate from the overview table to the details page — the exact flow that 404'd in prod.
		await spotlightArticlesPage.searchByTitle(title);
		await expect(spotlightArticlesPage.rowByTitle(title)).toBeVisible();
		await spotlightArticlesPage.gotoDetailsFromList(title);

		// The spotlight details page must render its content, not a 404 / notFound page.
		await expect(spotlightArticlesPage.page.getByText(title)).toBeVisible();
		await expect(spotlightArticlesPage.page.getByText(slug, { exact: true })).toBeVisible();
	});
});
