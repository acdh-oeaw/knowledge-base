import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { findAuditSubjectIdsMatching, resolveAuditSubjectLabel } from "@/lib/data/audit-log";
import { createDraftDocumentFromTitle } from "@/lib/data/entity-lifecycle";
import type { db } from "@/lib/db";
import { withTransaction } from "@/test/lib/with-transaction";

type Tx = Awaited<Parameters<Parameters<typeof db.transaction>[0]>[0]>;

async function getProjectTypeId(tx: Tx): Promise<string> {
	const type = await tx.query.entityTypes.findFirst({
		where: { type: "projects" },
		columns: { id: true },
	});
	assert(type, "projects entity type not found in database");

	return type.id;
}

async function getProjectScopeId(tx: Tx): Promise<string> {
	const scope = await tx.query.projectScopes.findFirst({
		columns: { id: true },
	});
	assert(scope, "project scope not found in database");

	return scope.id;
}

describe("resolveAuditSubjectLabel", () => {
	it("resolves project document ids to the current project name", async () => {
		await withTransaction(async (tx) => {
			const name = `Audit Project ${f.string.alphanumeric(10)}`;
			const typeId = await getProjectTypeId(tx);
			const scopeId = await getProjectScopeId(tx);
			const { documentId, versionId } = await createDraftDocumentFromTitle(tx, typeId, name);

			await tx.insert(schema.projects).values({
				id: versionId,
				name,
				scopeId,
				duration: { start: new Date("2026-01-01T00:00:00Z") },
			});

			await expect(resolveAuditSubjectLabel("projects", documentId, tx)).resolves.toBe(name);
		});
	});

	it("resolves asset ids to the media-library label", async () => {
		await withTransaction(async (tx) => {
			const label = `Audit Asset ${f.string.alphanumeric(10)}`;
			const [asset] = await tx
				.insert(schema.assets)
				.values({
					key: `test/audit-${f.string.uuid()}.jpg`,
					label,
					mimeType: "image/jpeg",
				})
				.returning({ id: schema.assets.id });
			assert(asset);

			await expect(resolveAuditSubjectLabel("assets", asset.id, tx)).resolves.toBe(label);
		});
	});
});

describe("findAuditSubjectIdsMatching", () => {
	it("finds entity documents by their current title", async () => {
		await withTransaction(async (tx) => {
			const name = `Audit Searchable ${f.string.alphanumeric(10)}`;
			const typeId = await getProjectTypeId(tx);
			const scopeId = await getProjectScopeId(tx);
			const { documentId, versionId } = await createDraftDocumentFromTitle(tx, typeId, name);

			await tx.insert(schema.projects).values({
				id: versionId,
				name,
				scopeId,
				duration: { start: new Date("2026-01-01T00:00:00Z") },
			});

			await expect(findAuditSubjectIdsMatching(name, tx)).resolves.toContain(documentId);
		});
	});

	it("matches terms in any order and ignores punctuation", async () => {
		await withTransaction(async (tx) => {
			const marker = f.string.alphanumeric(10);
			const typeId = await getProjectTypeId(tx);
			const scopeId = await getProjectScopeId(tx);
			const { documentId, versionId } = await createDraftDocumentFromTitle(
				tx,
				typeId,
				`Zeta-Project ${marker}`,
			);

			await tx.insert(schema.projects).values({
				id: versionId,
				name: `Zeta-Project ${marker}`,
				scopeId,
				duration: { start: new Date("2026-01-01T00:00:00Z") },
			});

			await expect(findAuditSubjectIdsMatching(`${marker} zeta project`, tx)).resolves.toContain(
				documentId,
			);
		});
	});

	it("finds assets by their media-library label", async () => {
		await withTransaction(async (tx) => {
			const label = `Audit Searchable Asset ${f.string.alphanumeric(10)}`;
			const [asset] = await tx
				.insert(schema.assets)
				.values({
					key: `test/audit-${f.string.uuid()}.jpg`,
					label,
					mimeType: "image/jpeg",
				})
				.returning({ id: schema.assets.id });
			assert(asset);

			await expect(findAuditSubjectIdsMatching(label, tx)).resolves.toContain(asset.id);
		});
	});

	it("finds reporting campaigns by their composed label", async () => {
		await withTransaction(async (tx) => {
			const campaign = await tx.query.reportingCampaigns.findFirst({
				columns: { id: true, year: true },
			});
			assert(campaign, "no reporting campaign found in database");

			await expect(
				findAuditSubjectIdsMatching(`Reporting campaign ${String(campaign.year)}`, tx),
			).resolves.toContain(campaign.id);
		});
	});

	it("returns no ids for a query that matches nothing", async () => {
		await withTransaction(async (tx) => {
			await expect(
				findAuditSubjectIdsMatching(`no-such-subject-${f.string.alphanumeric(16)}`, tx),
			).resolves.toEqual([]);
		});
	});
});
