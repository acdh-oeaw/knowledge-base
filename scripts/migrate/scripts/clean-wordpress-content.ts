import * as fs from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";
import { eq } from "drizzle-orm";

import { cacheFolderPath } from "../config/data-migration.config";
import { env } from "../config/env.config";
import {
	type OverExtendedLink,
	cleanTiptapDoc,
	findMidTextHardBreaks,
	findOverExtendedLinks,
} from "../src/lib/clean-tiptap-content";

/**
 * Post-migration cleanup for WordPress-originated rich text. Normalises the TipTap JSON stored in
 * rich_text and accordion content blocks (see `clean-tiptap-content.ts` for the rules) and writes a
 * report of over-extended links that need manual fixing.
 *
 * Idempotent: only rows whose content actually changes are updated. Pass `--dry-run` to report what
 * would change without writing and create a log of the affected entities.
 */

const isDryRun = process.argv.includes("--dry-run");

const db = createDatabaseService({
	connection: {
		database: env.DATABASE_NAME,
		host: env.DATABASE_HOST,
		password: env.DATABASE_PASSWORD,
		port: env.DATABASE_PORT,
		user: env.DATABASE_USER,
	},
	logger: false,
}).unwrap();

/** Serialises with sorted keys so that Postgres `jsonb` key reordering is not seen as a change. */
function stableStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(",")}]`;
	}
	if (value !== null && typeof value === "object") {
		return `{${Object.keys(value)
			.toSorted()
			.map(
				(key) =>
					`${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
			)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

function changed(before: JSONContent, after: JSONContent): boolean {
	return stableStringify(before) !== stableStringify(after);
}

function printDryRunChange(source: string, before: JSONContent, after: JSONContent): void {
	log.info(
		`[dry run] ${source}\nbefore:\n${JSON.stringify(before, null, 2)}\nafter:\n${JSON.stringify(after, null, 2)}`,
	);
}

interface ContentBlockOwner {
	entityId: string;
	entityLabel: string | null;
	entitySlug: string;
	entityType: string;
	fieldName: string;
	status: string;
}

function linkLine(issue: OverExtendedLink): string {
	return `${issue.href ?? "(no href)"}\t${issue.text}`;
}

async function writeReport(filePath: string, rows: Array<{ source: string; text: string }>) {
	if (rows.length === 0) {
		return;
	}
	await fs.mkdir(cacheFolderPath, { recursive: true });
	const report = rows.map(({ source, text }) => `${source}\t${text}`).join("\n");
	await fs.writeFile(filePath, `${report}\n`, { encoding: "utf-8" });
}

async function writeChangedEntitiesReport(filePath: string, entities: Array<string>) {
	await fs.mkdir(cacheFolderPath, { recursive: true });
	const header =
		"entity_type\tentity_id\ttitle\tfield\tstatus\tcontent_block_type\tcontent_block_id";
	await fs.writeFile(
		filePath,
		`${header}\n${entities.join("\n")}${entities.length > 0 ? "\n" : ""}`,
		{
			encoding: "utf-8",
		},
	);
}

function formatChangedEntity(
	owner: ContentBlockOwner | undefined,
	contentBlockType: "accordion" | "rich_text",
	contentBlockId: string,
): string {
	if (owner == null) {
		return `unknown\tunknown\tunknown\tunknown\tunknown\t${contentBlockType}\t${contentBlockId}`;
	}

	const title = (owner.entityLabel ?? owner.entitySlug).replaceAll(/\s+/g, " ").trim();
	return [
		owner.entityType,
		owner.entityId,
		title,
		owner.fieldName,
		owner.status,
		contentBlockType,
		contentBlockId,
	].join("\t");
}

const linkReportFilePath = path.join(cacheFolderPath, "wordpress-link-issues.log");
const hardBreakReportFilePath = path.join(cacheFolderPath, "wordpress-hardbreak-review.log");
const changedEntitiesReportFilePath = path.join(cacheFolderPath, "wordpress-content-dry-run.log");

async function main() {
	log.info(isDryRun ? "Cleaning WordPress content (dry run)..." : "Cleaning WordPress content...");

	const linkIssues: Array<{ source: string; text: string }> = [];
	const hardBreaks: Array<{ source: string; text: string }> = [];
	const changedEntities: Array<string> = [];
	let richTextChanged = 0;
	const contentBlockOwners = new Map<string, ContentBlockOwner>();

	if (isDryRun) {
		const owners = await db
			.select({
				contentBlockId: schema.contentBlocks.id,
				entityId: schema.entities.id,
				entityLabel: schema.entities.label,
				entitySlug: schema.slugs.value,
				entityType: schema.entityTypes.type,
				fieldName: schema.entityTypesFieldsNames.fieldName,
				status: schema.entityStatus.type,
			})
			.from(schema.contentBlocks)
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.innerJoin(schema.entityVersions, eq(schema.fields.entityVersionId, schema.entityVersions.id))
			.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id));

		for (const { contentBlockId, ...owner } of owners) {
			contentBlockOwners.set(contentBlockId, owner);
		}
	}

	const richTextBlocks = await db.query.richTextContentBlocks.findMany({
		columns: { id: true, content: true },
	});

	for (const block of richTextBlocks) {
		const cleaned = cleanTiptapDoc(block.content);

		for (const issue of findOverExtendedLinks(cleaned)) {
			linkIssues.push({ source: `rich_text:${block.id}`, text: linkLine(issue) });
		}
		for (const hardBreak of findMidTextHardBreaks(cleaned)) {
			hardBreaks.push({ source: `rich_text:${block.id}`, text: hardBreak.text });
		}

		if (!changed(block.content, cleaned)) {
			continue;
		}

		richTextChanged += 1;
		if (isDryRun) {
			changedEntities.push(
				formatChangedEntity(contentBlockOwners.get(block.id), "rich_text", block.id),
			);
			printDryRunChange(`rich_text:${block.id}`, block.content, cleaned);
		} else {
			await db
				.update(schema.richTextContentBlocks)
				.set({ content: cleaned })
				.where(eq(schema.richTextContentBlocks.id, block.id));
		}
	}

	await writeReport(linkReportFilePath, linkIssues);
	await writeReport(hardBreakReportFilePath, hardBreaks);
	if (isDryRun) {
		await writeChangedEntitiesReport(changedEntitiesReportFilePath, changedEntities);
	}

	log.success(
		// Accordion panel bodies are `rich_text` blocks of their own, so they are counted above along
		// with everything else stored that way.
		`${isDryRun ? "[dry run] Would clean" : "Cleaned"} ${String(richTextChanged)} rich_text block(s).`,
	);
	log.info(
		`Over-extended links: ${String(linkIssues.length)}${
			linkIssues.length > 0 ? ` (report: ${linkReportFilePath})` : ""
		}.`,
	);
	log.info(
		`Mid-text line breaks kept for review: ${String(hardBreaks.length)}${
			hardBreaks.length > 0 ? ` (report: ${hardBreakReportFilePath})` : ""
		}.`,
	);
	if (isDryRun) {
		log.info(`Changed entities report: ${changedEntitiesReportFilePath}.`);
	}
}

main()
	.then(() => db.$client.end())
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	});
