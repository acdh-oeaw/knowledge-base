import * as readline from "node:readline/promises";

import { assert, log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq, gt, inArray, sql } from "@dariah-eric/database/sql";

import { env } from "../config/env.config";
import { type EntityStatusType, groupByEntityVersion } from "../lib/entity-versions";

/**
 * Promotes a _presentational_ floated `image` block into a _semantic_ `media_text` block for the
 * named news items — the opt-in, human-vetted counterpart to `backfill-image-alignment`. Use it
 * where the image and the text beside it genuinely belong together (a portrait next to a bio, a
 * logo next to a working-group blurb) rather than the image merely being floated for size.
 *
 * Slugs are passed as positional arguments. By default it prompts once per floated image (showing
 * the text beside it), so within one item the first image can stay floated and the next convert;
 * `--all` converts every pair without prompting, and `--dry-run` only lists them.
 *
 * @example
 * 	pnpm run data:convert:floated-images-to-media-text -- some-news-slug another-news-slug
 * 	pnpm run data:convert:floated-images-to-media-text -- --dry-run some-news-slug
 * 	pnpm run data:convert:floated-images-to-media-text -- --all some-news-slug
 *
 * 	Operates on the database alone (no WordPress round-trip): within each named item's `content`
 * 	field it finds every `image` block whose `layout` is `float-start`/`float-end` and whose *next*
 * 	block is `rich_text`, and collapses each confirmed pair into one `media_text` block — reusing the
 * 	image block's row (only its type and subtype row change), deleting the `rich_text` block, and
 * 	closing the position gap. The `media_text` `side` is taken from the float (`float-start` →
 * 	`start`, `float-end` → `end`). A floated image not followed by `rich_text` is left as an `image`.
 *
 * 	Every version of the item is converted, draft and published alike — see `lib/entity-versions`
 * 	for why. One prompt covers all of them: a floated image that appears beside the same text in
 * 	both versions is one editorial decision, and answering it twice could only make them diverge.
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

/** Minimal shape of a TipTap document node — just what the preview traversal reads. */
interface RichTextNode {
	text?: string;
	content?: Array<RichTextNode>;
}

interface EntityBlock {
	blockId: string;
	blockType: string;
	position: number;
	imageId: string | null;
	imageLayout: (typeof schema.imageLayoutEnum)[number] | null;
	richTextContent: RichTextNode | null;
}

/** One lifecycle version's `content` field and its blocks, in position order. */
interface EntityVersion {
	fieldId: string;
	status: EntityStatusType;
	blocks: Array<EntityBlock>;
}

/** Flattens a TipTap document's text nodes into a single string, for a decision-aiding preview. */
function extractPlainText(content: RichTextNode | null): string {
	if (content == null) {
		return "";
	}
	const parts: Array<string> = [];
	const visit = (node: RichTextNode): void => {
		if (typeof node.text === "string") {
			parts.push(node.text);
		}
		for (const child of node.content ?? []) {
			visit(child);
		}
	};
	visit(content);
	return parts.join(" ").replaceAll(/\s+/g, " ").trim();
}

function truncate(text: string, max = 160): string {
	return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** `news` entities' `content` blocks, ordered by position, per version, for the given slugs only. */
async function findNewsEntityBlocks(
	slugs: Array<string>,
): Promise<Map<string, Array<EntityVersion>>> {
	const rows = await db
		.select({
			slug: schema.slugs.value,
			status: schema.entityStatus.type,
			blockId: schema.contentBlocks.id,
			fieldId: schema.contentBlocks.fieldId,
			blockType: schema.contentBlockTypes.type,
			position: schema.contentBlocks.position,
			imageId: schema.imageContentBlocks.imageId,
			imageLayout: schema.imageContentBlocks.layout,
			richTextContent: schema.richTextContentBlocks.content,
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
			schema.contentBlockTypes,
			eq(schema.contentBlocks.typeId, schema.contentBlockTypes.id),
		)
		.leftJoin(schema.imageContentBlocks, eq(schema.imageContentBlocks.id, schema.contentBlocks.id))
		.leftJoin(
			schema.richTextContentBlocks,
			eq(schema.richTextContentBlocks.id, schema.contentBlocks.id),
		)
		.where(
			and(
				eq(schema.entityTypes.type, "news"),
				eq(schema.entityTypesFieldsNames.fieldName, "content"),
				inArray(schema.slugs.value, slugs),
			),
		)
		.orderBy(schema.slugs.value, schema.entityStatus.type, schema.contentBlocks.position);

	return groupByEntityVersion(rows, {
		documentKey: (row) => row.slug,
		create: (row): EntityVersion => {
			return { fieldId: row.fieldId, status: row.status, blocks: [] };
		},
		add: (version, row) => {
			version.blocks.push({
				blockId: row.blockId,
				blockType: row.blockType,
				position: row.position,
				imageId: row.imageId,
				imageLayout: row.imageLayout,
				richTextContent: row.richTextContent,
			});
		},
	});
}

interface Pair {
	entitySlug: string;
	status: EntityStatusType;
	side: (typeof schema.mediaTextSideEnum)[number];
	fieldId: string;
	imageContentBlockId: string;
	imagePosition: number;
	richTextContentBlockId: string;
	/** The asset, used to recognise the same floated image across a document's versions. */
	imageId: string | null;
	/** Plain-text preview of the wrapping rich_text, to decide whether the pairing is semantic. */
	preview: string;
}

/**
 * The same floated image usually exists in both the draft and the published version. That is one
 * editorial decision, not two, so pairs are grouped by image and by the text beside it — matching
 * on content rather than on position, which shifts between versions as soon as a draft diverges
 * further up the field.
 */
interface Decision {
	entitySlug: string;
	side: (typeof schema.mediaTextSideEnum)[number];
	preview: string;
	pairs: Array<Pair>;
}

function findPairs(
	slugs: Array<string>,
	versionsBySlug: Map<string, Array<EntityVersion>>,
): Array<Pair> {
	const pairs: Array<Pair> = [];

	for (const slug of slugs) {
		const versions = versionsBySlug.get(slug);
		if (versions == null) {
			log.warn(`No news item with a \`content\` field for slug \`${slug}\`.`);
			continue;
		}

		for (const version of versions) {
			const blocksByPosition = new Map(version.blocks.map((block) => [block.position, block]));

			for (const block of version.blocks) {
				if (
					block.blockType !== "image" ||
					(block.imageLayout !== "float-start" && block.imageLayout !== "float-end")
				) {
					continue;
				}

				const nextBlock = blocksByPosition.get(block.position + 1);
				if (nextBlock?.blockType !== "rich_text") {
					log.warn(
						`Skipping a floated image in \`${slug}\` (${version.status}): not followed by a \`rich_text\` block.`,
					);
					continue;
				}

				pairs.push({
					entitySlug: slug,
					status: version.status,
					side: block.imageLayout === "float-end" ? "end" : "start",
					fieldId: version.fieldId,
					imageContentBlockId: block.blockId,
					imagePosition: block.position,
					richTextContentBlockId: nextBlock.blockId,
					imageId: block.imageId,
					preview: truncate(extractPlainText(nextBlock.richTextContent)),
				});
			}
		}
	}

	return pairs;
}

/** Collapses the per-version pairs into one decision per floated image. */
function groupDecisions(pairs: Array<Pair>): Array<Decision> {
	const byKey = new Map<string, Decision>();

	for (const pair of pairs) {
		const key = JSON.stringify([pair.entitySlug, pair.side, pair.imageId, pair.preview]);

		const decision = byKey.get(key);
		if (decision == null) {
			byKey.set(key, {
				entitySlug: pair.entitySlug,
				side: pair.side,
				preview: pair.preview,
				pairs: [pair],
			});
		} else {
			decision.pairs.push(pair);
		}
	}

	return [...byKey.values()];
}

/**
 * Collapses each pair inside its own transaction, re-reading both blocks first so a pairing that
 * changed since it was found (an editor touched the item, or a previous run already applied it) is
 * skipped rather than forced.
 */
async function applyPairs(pairs: Array<Pair>): Promise<number> {
	const [mediaTextType] = await db
		.select({ id: schema.contentBlockTypes.id })
		.from(schema.contentBlockTypes)
		.where(eq(schema.contentBlockTypes.type, "media_text"))
		.limit(1);
	assert(mediaTextType, "Missing `media_text` content block type.");

	let applied = 0;

	for (const pair of pairs) {
		await db.transaction(async (tx) => {
			const [imageBlock] = await tx
				.select({
					id: schema.contentBlocks.id,
					fieldId: schema.contentBlocks.fieldId,
					position: schema.contentBlocks.position,
					imageId: schema.imageContentBlocks.imageId,
					caption: schema.imageContentBlocks.caption,
					captionMode: schema.imageContentBlocks.captionMode,
				})
				.from(schema.contentBlocks)
				.innerJoin(
					schema.imageContentBlocks,
					eq(schema.imageContentBlocks.id, schema.contentBlocks.id),
				)
				.where(eq(schema.contentBlocks.id, pair.imageContentBlockId))
				.limit(1);

			const [richTextBlock] = await tx
				.select({
					id: schema.contentBlocks.id,
					fieldId: schema.contentBlocks.fieldId,
					position: schema.contentBlocks.position,
					content: schema.richTextContentBlocks.content,
				})
				.from(schema.contentBlocks)
				.innerJoin(
					schema.richTextContentBlocks,
					eq(schema.richTextContentBlocks.id, schema.contentBlocks.id),
				)
				.where(eq(schema.contentBlocks.id, pair.richTextContentBlockId))
				.limit(1);

			if (imageBlock == null || richTextBlock == null) {
				log.warn(`Skipping ${pair.entitySlug} (${pair.status}): block no longer exists.`);
				return;
			}

			if (
				richTextBlock.fieldId !== imageBlock.fieldId ||
				richTextBlock.position !== imageBlock.position + 1
			) {
				log.warn(
					`Skipping ${pair.entitySlug} (${pair.status}): no longer adjacent — item was edited since it was found.`,
				);
				return;
			}

			await tx
				.delete(schema.imageContentBlocks)
				.where(eq(schema.imageContentBlocks.id, imageBlock.id));

			// Both block types resolve captions the same way, so the image block's caption and its
			// `captionMode` carry over untouched — a credit set on the float is not lost in the swap.
			await tx.insert(schema.mediaTextContentBlocks).values({
				id: imageBlock.id,
				imageId: imageBlock.imageId,
				side: pair.side,
				content: richTextBlock.content,
				caption: imageBlock.caption,
				captionMode: imageBlock.captionMode,
			});

			await tx
				.update(schema.contentBlocks)
				.set({ typeId: mediaTextType.id })
				.where(eq(schema.contentBlocks.id, imageBlock.id));

			await tx.delete(schema.contentBlocks).where(eq(schema.contentBlocks.id, richTextBlock.id));

			await tx
				.update(schema.contentBlocks)
				.set({ position: sql`${schema.contentBlocks.position} - 1` })
				.where(
					and(
						eq(schema.contentBlocks.fieldId, imageBlock.fieldId),
						gt(schema.contentBlocks.position, richTextBlock.position),
					),
				);

			applied += 1;
		});
	}

	return applied;
}

/** Names the versions a decision covers, so the prompt and the dry run say what will be touched. */
function describeVersions(decision: Decision): string {
	return decision.pairs
		.map((pair) => pair.status)
		.toSorted()
		.join(", ");
}

/**
 * Prompts once per floated image, so an author can keep one floated and convert the next within the
 * same news item, and returns the pairs of the confirmed ones — every version of that image, since
 * one answer settles it for the document. Skipped by `--all` (convert everything) and `--dry-run`
 * (list only).
 */
async function confirmDecisions(decisions: Array<Decision>): Promise<Array<Pair>> {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const confirmed: Array<Pair> = [];

	try {
		for (const decision of decisions) {
			const answer = await rl.question(
				`\n${decision.entitySlug} — floated image (${decision.side}), in ${describeVersions(decision)}, text beside it:\n  “${decision.preview}”\nConvert this to a media_text block? [y/N] `,
			);
			if (answer.trim().toLowerCase().startsWith("y")) {
				confirmed.push(...decision.pairs);
			}
		}
	} finally {
		rl.close();
	}

	return confirmed;
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const convertAll = args.includes("--all");
	const dryRun = args.includes("--dry-run");
	const slugs = args.filter((arg) => !arg.startsWith("--"));

	if (slugs.length === 0) {
		log.error("Pass one or more news item slugs as positional arguments.");
		process.exitCode = 1;
		return;
	}

	const versionsBySlug = await findNewsEntityBlocks(slugs);
	const pairs = findPairs(slugs, versionsBySlug);
	const decisions = groupDecisions(pairs);

	log.info(
		`${String(decisions.length)} floated images found across ${String(slugs.length)} slugs (${String(pairs.length)} blocks, counting each version).`,
	);

	if (dryRun || decisions.length === 0) {
		for (const decision of decisions) {
			log.info(
				`  ${decision.entitySlug} (${decision.side}, ${describeVersions(decision)}): “${decision.preview}”`,
			);
		}
		if (decisions.length > 0) {
			log.info(`Dry run — re-run without \`--dry-run\` to choose which to convert (or \`--all\`).`);
		}
		return;
	}

	// `--all` converts everything; otherwise prompt per image so floats can be kept or promoted
	// individually within the same item. Either way a converted image is converted in every version.
	const selected = convertAll ? pairs : await confirmDecisions(decisions);

	if (selected.length === 0) {
		log.info("Nothing selected; no changes made.");
		return;
	}

	const applied = await applyPairs(selected);
	log.success(`Collapsed ${String(applied)} pairs into media_text blocks.`);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());
