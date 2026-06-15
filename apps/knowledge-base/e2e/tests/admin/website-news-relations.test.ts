import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website news admin – related entities", () => {
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		await db.getTestAsset();
		/** Verify that at least one entity exists for us to relate to. */
		await db.getTestEntity();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerNewsItems(testInfo.workerIndex);
	});

	test("should save a related entity when creating a news item", async ({
		createWebsiteNewsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const newsPage = createWebsiteNewsPage(workerIndex);
		const testEntity = await db.getTestEntity();

		const title = `${newsPage.workerPrefix} Relations Create ${randomUUID()}`;

		await newsPage.gotoCreate();
		await newsPage.fillTitle(title);
		await newsPage.fillSummary("E2E test — create with related entity");
		await newsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await newsPage.selectRelatedEntity(testEntity.name);
		await newsPage.submitForm();

		const newsItem = await db.getNewsItemByTitle(title);
		expect(newsItem).not.toBeNull();

		const relations = await db.getEntityRelations(newsItem!.id);
		expect(relations.relatedEntityIds).toContain(testEntity.id);
	});

	test("should add a related entity when editing a news item", async ({
		page,
		createWebsiteNewsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const newsPage = createWebsiteNewsPage(workerIndex);
		const testEntity = await db.getTestEntity();

		const title = `${newsPage.workerPrefix} Relations Add ${randomUUID()}`;

		await newsPage.gotoCreate();
		await newsPage.fillTitle(title);
		await newsPage.fillSummary("E2E test — edit to add related entity");
		await newsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await newsPage.submitForm();

		const newsItemBefore = await db.getNewsItemByTitle(title);
		expect(newsItemBefore).not.toBeNull();
		const relationsBefore = await db.getEntityRelations(newsItemBefore!.id);
		expect(relationsBefore.relatedEntityIds).toHaveLength(0);

		await newsPage.searchByTitle(title);
		const row = newsPage.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		await newsPage.selectRelatedEntity(testEntity.name);
		await newsPage.submitForm();

		const relations = await db.getEntityRelations(newsItemBefore!.id);
		expect(relations.relatedEntityIds).toContain(testEntity.id);
	});

	test("should remove a related entity when editing a news item", async ({
		page,
		createWebsiteNewsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const newsPage = createWebsiteNewsPage(workerIndex);
		const testEntity = await db.getTestEntity();

		const title = `${newsPage.workerPrefix} Relations Remove ${randomUUID()}`;

		await newsPage.gotoCreate();
		await newsPage.fillTitle(title);
		await newsPage.fillSummary("E2E test — edit to remove related entity");
		await newsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await newsPage.selectRelatedEntity(testEntity.name);
		await newsPage.submitForm();

		const newsItem = await db.getNewsItemByTitle(title);
		expect(newsItem).not.toBeNull();
		const relationsBefore = await db.getEntityRelations(newsItem!.id);
		expect(relationsBefore.relatedEntityIds).toContain(testEntity.id);

		await newsPage.searchByTitle(title);
		const row = newsPage.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		await newsPage.removeRelatedEntity(testEntity.name);
		await newsPage.submitForm();

		const relations = await db.getEntityRelations(newsItem!.id);
		expect(relations.relatedEntityIds).not.toContain(testEntity.id);
	});

	test("should keep remaining related entities when one of several relations is removed", async ({
		createWebsiteNewsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const newsPage = createWebsiteNewsPage(workerIndex);
		const testEntities = await db.getTestEntities(2);
		const firstEntity = testEntities[0]!;
		const secondEntity = testEntities[1]!;

		const title = `${newsPage.workerPrefix} Relations Multiple ${randomUUID()}`;

		await newsPage.gotoCreate();
		await newsPage.fillTitle(title);
		await newsPage.fillSummary("E2E test — remove one of several related entities");
		await newsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await newsPage.selectRelatedEntity(firstEntity.name);
		await newsPage.selectRelatedEntity(secondEntity.name);
		await newsPage.submitForm();

		const newsItem = await db.getNewsItemByTitle(title);
		expect(newsItem).not.toBeNull();
		const relationsBefore = await db.getEntityRelations(newsItem!.id);
		expect(relationsBefore.relatedEntityIds).toStrictEqual(
			expect.arrayContaining([firstEntity.id, secondEntity.id]),
		);

		await newsPage.searchByTitle(title);
		await newsPage.gotoEditFromList(title);
		await newsPage.removeRelatedEntity(firstEntity.name);
		await newsPage.submitForm();

		const relations = await db.getEntityRelations(newsItem!.id);
		expect(relations.relatedEntityIds).not.toContain(firstEntity.id);
		expect(relations.relatedEntityIds).toContain(secondEntity.id);
	});

	test("should preserve the relation row when editing unrelated fields", async ({
		page,
		createWebsiteNewsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const newsPage = createWebsiteNewsPage(workerIndex);
		const testEntity = await db.getTestEntity();

		const title = `${newsPage.workerPrefix} Relations Stable ${randomUUID()}`;

		await newsPage.gotoCreate();
		await newsPage.fillTitle(title);
		await newsPage.fillSummary("E2E test — relation row should be stable across saves");
		await newsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await newsPage.selectRelatedEntity(testEntity.name);
		await newsPage.submitForm();

		const newsItem = await db.getNewsItemByTitle(title);
		expect(newsItem).not.toBeNull();
		const rowBefore = await db.getEntitiesToEntitiesRow(newsItem!.id, testEntity.id);
		expect(rowBefore).not.toBeNull();

		await newsPage.searchByTitle(title);
		const row = newsPage.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedTitle = `${newsPage.workerPrefix} Relations Stable Updated ${randomUUID()}`;
		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(updatedTitle);
		await newsPage.submitForm();

		const rowAfter = await db.getEntitiesToEntitiesRow(newsItem!.id, testEntity.id);
		expect(rowAfter).not.toBeNull();
		expect(rowAfter!.createdAt).toStrictEqual(rowBefore!.createdAt);
	});
});
