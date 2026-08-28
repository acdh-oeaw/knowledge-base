import { randomUUID } from "node:crypto";

import type { AdminProjectsPage } from "@/e2e/lib/fixtures/admin-projects-page";
import { expect, test } from "@/e2e/lib/test";

/** Fill the minimum required fields on the create-project form (name, scope, start date, summary). */
async function fillRequiredProjectFields(
	projectsPage: AdminProjectsPage,
	name: string,
	summary: string,
): Promise<void> {
	await projectsPage.gotoCreate();
	await projectsPage.fillName(name);
	await projectsPage.selectFirstScope();
	await projectsPage.fillDatePicker("Start date", 2024, 1, 15);
	await projectsPage.fillSummary(summary);
}

test.describe("projects admin – related entities", () => {
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		await db.getProjectScope();
		/** Verify that at least one entity exists for us to relate to. */
		await db.getTestEntity();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerProjects(testInfo.workerIndex);
	});

	test("should save a related entity when creating a project", async ({
		createAdminProjectsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const projectsPage = createAdminProjectsPage(workerIndex);
		const testEntity = await db.getTestEntity();

		const name = `${projectsPage.workerPrefix} Relations Create ${randomUUID()}`;

		await fillRequiredProjectFields(projectsPage, name, "E2E test — create with related entity");
		await projectsPage.selectRelatedEntity(testEntity.name);
		await projectsPage.submitForm();

		const project = await db.getProjectByName(name);
		expect(project).not.toBeNull();

		const relations = await db.getEntityRelations(project!.documentId);
		expect(relations.relatedEntityIds).toContain(testEntity.id);
	});

	test("should add a related entity when editing a project", async ({
		createAdminProjectsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const projectsPage = createAdminProjectsPage(workerIndex);
		const testEntity = await db.getTestEntity();

		const name = `${projectsPage.workerPrefix} Relations Add ${randomUUID()}`;

		await fillRequiredProjectFields(projectsPage, name, "E2E test — edit to add related entity");
		await projectsPage.submitForm();

		const projectBefore = await db.getProjectByName(name);
		expect(projectBefore).not.toBeNull();
		const relationsBefore = await db.getEntityRelations(projectBefore!.documentId);
		expect(relationsBefore.relatedEntityIds).toHaveLength(0);

		await projectsPage.searchByName(name);
		await projectsPage.gotoEditFromList(name);
		await projectsPage.selectRelatedEntity(testEntity.name);
		await projectsPage.submitForm();

		const relations = await db.getEntityRelations(projectBefore!.documentId);
		expect(relations.relatedEntityIds).toContain(testEntity.id);
	});

	test("should remove a related entity when editing a project", async ({
		createAdminProjectsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const projectsPage = createAdminProjectsPage(workerIndex);
		const testEntity = await db.getTestEntity();

		const name = `${projectsPage.workerPrefix} Relations Remove ${randomUUID()}`;

		await fillRequiredProjectFields(projectsPage, name, "E2E test — edit to remove related entity");
		await projectsPage.selectRelatedEntity(testEntity.name);
		await projectsPage.submitForm();

		const project = await db.getProjectByName(name);
		expect(project).not.toBeNull();
		const relationsBefore = await db.getEntityRelations(project!.documentId);
		expect(relationsBefore.relatedEntityIds).toContain(testEntity.id);

		await projectsPage.searchByName(name);
		await projectsPage.gotoEditFromList(name);
		await projectsPage.removeRelatedEntity(testEntity.name);
		await projectsPage.submitForm();

		const relations = await db.getEntityRelations(project!.documentId);
		expect(relations.relatedEntityIds).not.toContain(testEntity.id);
	});

	test("should keep remaining related entities when one of several relations is removed", async ({
		createAdminProjectsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const projectsPage = createAdminProjectsPage(workerIndex);
		const testEntities = await db.getTestEntities(2);
		const firstEntity = testEntities[0]!;
		const secondEntity = testEntities[1]!;

		const name = `${projectsPage.workerPrefix} Relations Multiple ${randomUUID()}`;

		await fillRequiredProjectFields(
			projectsPage,
			name,
			"E2E test — remove one of several related entities",
		);
		await projectsPage.selectRelatedEntity(firstEntity.name);
		await projectsPage.selectRelatedEntity(secondEntity.name);
		await projectsPage.submitForm();

		const project = await db.getProjectByName(name);
		expect(project).not.toBeNull();
		const relationsBefore = await db.getEntityRelations(project!.documentId);
		expect(relationsBefore.relatedEntityIds).toStrictEqual(
			expect.arrayContaining([firstEntity.id, secondEntity.id]),
		);

		await projectsPage.searchByName(name);
		await projectsPage.gotoEditFromList(name);
		await projectsPage.removeRelatedEntity(firstEntity.name);
		await projectsPage.submitForm();

		const relations = await db.getEntityRelations(project!.documentId);
		expect(relations.relatedEntityIds).not.toContain(firstEntity.id);
		expect(relations.relatedEntityIds).toContain(secondEntity.id);
	});

	test("should preserve the relation row when editing unrelated fields", async ({
		createAdminProjectsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const projectsPage = createAdminProjectsPage(workerIndex);
		const testEntity = await db.getTestEntity();

		const name = `${projectsPage.workerPrefix} Relations Stable ${randomUUID()}`;

		await fillRequiredProjectFields(
			projectsPage,
			name,
			"E2E test — relation row should be stable across saves",
		);
		await projectsPage.selectRelatedEntity(testEntity.name);
		await projectsPage.submitForm();

		const project = await db.getProjectByName(name);
		expect(project).not.toBeNull();
		const rowBefore = await db.getEntitiesToEntitiesRow(project!.documentId, testEntity.id);
		expect(rowBefore).not.toBeNull();

		await projectsPage.searchByName(name);
		await projectsPage.gotoEditFromList(name);
		await projectsPage.fillSummary(`E2E test — updated summary ${randomUUID()}`);
		await projectsPage.submitForm();

		const rowAfter = await db.getEntitiesToEntitiesRow(project!.documentId, testEntity.id);
		expect(rowAfter).not.toBeNull();
		expect(rowAfter!.createdAt).toStrictEqual(rowBefore!.createdAt);
	});

	test("should persist a reordered related-entity selection", async ({
		createAdminProjectsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const projectsPage = createAdminProjectsPage(workerIndex);
		const testEntities = await db.getTestEntities(2);
		const firstEntity = testEntities[0]!;
		const secondEntity = testEntities[1]!;

		const name = `${projectsPage.workerPrefix} Relations Reorder ${randomUUID()}`;

		await fillRequiredProjectFields(projectsPage, name, "E2E test — reorder related entities");
		await projectsPage.selectRelatedEntity(firstEntity.name);
		await projectsPage.selectRelatedEntity(secondEntity.name);
		await projectsPage.submitForm();

		const project = await db.getProjectByName(name);
		expect(project).not.toBeNull();

		// The relations are persisted in selection order.
		const relationsBefore = await db.getEntityRelations(project!.documentId);
		expect(relationsBefore.relatedEntityIds).toStrictEqual([firstEntity.id, secondEntity.id]);

		await projectsPage.searchByName(name);
		await projectsPage.gotoEditFromList(name);

		// Drag the first related entity below the second: [first, second] -> [second, first].
		await projectsPage.moveRelatedEntityDown(firstEntity.name);
		const orderedNames = await projectsPage.getRelatedEntityNames();
		expect(orderedNames[0]).toContain(secondEntity.name);

		await projectsPage.submitForm();

		const relationsAfter = await db.getEntityRelations(project!.documentId);
		expect(relationsAfter.relatedEntityIds).toStrictEqual([secondEntity.id, firstEntity.id]);
	});
});
