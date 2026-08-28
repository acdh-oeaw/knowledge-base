import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";
import { and, eq, inArray } from "drizzle-orm";

import { env } from "../config/env.config";
import {
	type ConversionResult,
	convertLegacyFootnotes,
	noteToPlainText,
} from "../src/lib/legacy-footnotes";

/**
 * Converts the WordPress-era footnote apparatus of named **spotlight articles** — literal `[1]`
 * markers plus a `[1] …` list under a "References" heading — into native `footnote` nodes. See
 * `src/lib/legacy-footnotes.ts` for the transform and why a converted article renumbers itself.
 *
 * Dry run by default: it prints, per article, every note it lifted and what each legacy label will
 * render as. Pass `--apply` to write.
 *
 * @example
 * 	pnpm run data:migrate:legacy-footnotes -- some-spotlight-slug
 * 	pnpm run data:migrate:legacy-footnotes -- --apply some-spotlight-slug
 *
 * 	Spotlight articles only, and only the ones named on the command line. Impact case studies carry
 * 	the same legacy apparatus and must keep it: they are deposited on Zenodo with their numbering,
 * 	which this conversion cannot preserve. Scoping the query to `spotlight_articles` makes that a
 * 	property of the script rather than a note in a readme.
 *
 * 	Every version of an article is converted, draft and published alike. Scoping to the published
 * 	version reads as the safe choice and is the opposite: the CMS edit pages render the draft, so a
 * 	change that lands only on the published version is invisible to editors and is undone the next
 * 	time anybody opens the article and saves. See `scripts/maintenance/lib/entity-versions.ts`.
 *
 * 	`--apply` re-reads and re-converts inside the transaction it writes in, so an article edited
 * 	since the dry run is re-judged on its current content rather than overwritten with a stale one.
 */

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

interface Version {
	/** The `fields` row holding this version's content blocks — unique per version, so it is the key. */
	fieldId: string;
	slug: string;
	status: string;
	blocks: Array<{ id: string; position: number; content: JSONContent }>;
}

type Queryable = typeof db | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/** Every version's `content` rich-text blocks, in position order, for the named spotlight articles. */
async function findVersions(tx: Queryable, slugs: Array<string>): Promise<Array<Version>> {
	const rows = await tx
		.select({
			slug: schema.slugs.value,
			status: schema.entityStatus.type,
			fieldId: schema.fields.id,
			blockId: schema.contentBlocks.id,
			position: schema.contentBlocks.position,
			content: schema.richTextContentBlocks.content,
		})
		.from(schema.entities)
		.innerJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.entityId, schema.entities.id))
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.innerJoin(schema.fields, eq(schema.fields.entityVersionId, schema.entityVersions.id))
		.innerJoin(
			schema.entityTypesFieldsNames,
			eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
		)
		.innerJoin(schema.contentBlocks, eq(schema.contentBlocks.fieldId, schema.fields.id))
		.innerJoin(
			schema.richTextContentBlocks,
			eq(schema.richTextContentBlocks.id, schema.contentBlocks.id),
		)
		.where(
			and(
				eq(schema.entityTypes.type, "spotlight_articles"),
				eq(schema.entityTypesFieldsNames.fieldName, "content"),
				inArray(schema.slugs.value, slugs),
			),
		)
		.orderBy(schema.slugs.value, schema.entityStatus.type, schema.contentBlocks.position);

	const byField = new Map<string, Version>();

	for (const row of rows) {
		let version = byField.get(row.fieldId);
		if (version == null) {
			version = { fieldId: row.fieldId, slug: row.slug, status: row.status, blocks: [] };
			byField.set(row.fieldId, version);
		}
		version.blocks.push({
			id: row.blockId,
			position: row.position,
			content: row.content,
		});
	}

	return [...byField.values()];
}

function describe(version: Version): string {
	return `${version.slug} (${version.status})`;
}

function report(version: Version, result: ConversionResult): void {
	if (result.notes.size === 0) {
		log.info(`${describe(version)}: no reference list found — nothing to convert.`);
		return;
	}

	const changed = result.blocks.filter((block) => block.changed).length;
	log.info(
		`${describe(version)}: ${String(result.notes.size)} note(s), ${String(result.numbering.length)} marker(s), ${String(changed)} block(s) to update.`,
	);

	// Only the labels that move are worth listing: an article whose markers were already in order and
	// cited once each keeps its numbering, and saying so in one line beats printing an identity map.
	const moved = result.numbering.filter((entry) => entry.label !== entry.number);
	if (moved.length === 0) {
		log.info("  numbering unchanged.");
	} else {
		for (const entry of moved) {
			log.info(`  [${String(entry.label)}] renders as ${String(entry.number)}`);
		}
	}

	for (const [index, entry] of result.numbering.entries()) {
		if (result.numbering.findIndex((other) => other.label === entry.label) !== index) {
			log.info(
				`  [${String(entry.label)}] is cited more than once; note ${String(entry.number)} repeats it.`,
			);
		}
	}

	for (const [label, note] of result.notes) {
		log.info(`  note [${String(label)}] ${JSON.stringify(noteToPlainText(note).slice(0, 120))}`);
	}

	for (const warning of result.warnings) {
		log.info(`  ${warning}`);
	}

	for (const problem of result.problems) {
		log.warn(`  ${problem}`);
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const apply = args.includes("--apply");
	const slugs = args.filter((arg) => !arg.startsWith("--"));

	if (slugs.length === 0) {
		log.error("Pass one or more spotlight article slugs as positional arguments.");
		process.exitCode = 1;
		return;
	}

	const versions = await findVersions(db, slugs);

	for (const slug of slugs) {
		if (!versions.some((version) => version.slug === slug)) {
			log.warn(`No spotlight article with a \`content\` field for slug \`${slug}\`.`);
		}
	}

	const convertible: Array<Version> = [];
	let blocked = false;

	for (const version of versions) {
		const result = convertLegacyFootnotes(version.blocks);
		report(version, result);

		if (result.problems.length > 0) {
			blocked = true;
		} else if (result.blocks.some((block) => block.changed)) {
			convertible.push(version);
		}
	}

	// A problem in any version blocks the whole run, rather than converting the rest: the draft and
	// the published version of one article are the same text, and converting one of them alone is
	// exactly the divergence this script is otherwise careful to avoid.
	if (blocked) {
		log.error("Problems reported above; nothing was written. Resolve them and re-run.");
		process.exitCode = 1;
		return;
	}

	if (!apply) {
		log.info(
			convertible.length > 0
				? "Dry run — re-run with `--apply` to write."
				: "Dry run — nothing to change.",
		);
		return;
	}

	let updated = 0;

	// One transaction per version, so an article is never left half-converted: the notes live in the
	// last block and the markers in every block, and writing only some of those would drop notes.
	for (const version of convertible) {
		await db.transaction(async (tx) => {
			const [current] = await findVersions(tx, [version.slug]).then((found) =>
				found.filter((candidate) => candidate.fieldId === version.fieldId),
			);

			if (current == null) {
				log.warn(`Skipping ${describe(version)}: the version no longer exists.`);
				return;
			}

			const result = convertLegacyFootnotes(current.blocks);

			if (result.problems.length > 0) {
				log.warn(`Skipping ${describe(version)}: edited since the dry run, problems now reported.`);
				for (const problem of result.problems) {
					log.warn(`  ${problem}`);
				}
				return;
			}

			for (const block of result.blocks) {
				if (!block.changed) {
					continue;
				}
				await tx
					.update(schema.richTextContentBlocks)
					.set({ content: block.content })
					.where(eq(schema.richTextContentBlocks.id, block.id));
				updated += 1;
			}

			log.success(`Converted ${describe(version)}.`);
		});
	}

	log.success(`Updated ${String(updated)} rich_text block(s).`);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());
