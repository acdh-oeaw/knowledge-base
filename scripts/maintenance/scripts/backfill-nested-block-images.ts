import { assert, log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq, inArray, isNotNull } from "@dariah-eric/database/sql";

import { env } from "../config/env.config";
import { type SplitPart, planCandidateRewrite, splitBody } from "../lib/nested-block-images";

/**
 * Splits the images out of container bodies, so an image inside a callout or an accordion panel is
 * an `image` block with a real reference to its asset instead of a key inside a jsonb document. Dry
 * run by default; `--apply` writes the changes.
 *
 * The second half of the move to nested content blocks. The migration
 * (`20260812120000_nest_content_blocks`) carried every body across structurally, as a single
 * `rich_text` child — which is exactly what those bodies were, except where an author had already
 * dropped an image into an accordion panel. That was possible in the old editor and stored only as
 * an `assetImage` node's `imageKey`: no foreign key, and nothing for the public API to resolve into
 * a url, alt text or licence. Doing the split needs an asset lookup per key, which is why it is
 * here and not in the migration.
 *
 * Only nested `rich_text` blocks are touched, and only their top-level nodes — the same rule the
 * editor's own splitter applies to a document, applied one level down. A run of ordinary prose
 * stays one block; each `assetImage` between two runs becomes an `image` block of its own, in
 * place.
 *
 * Conservative and idempotent: a body with no `assetImage` node is left alone, so re-runs and
 * already-split bodies cost nothing. An `assetImage` whose key names no asset is left in the
 * document rather than dropped — it renders no worse than it does today, and deleting an author's
 * content on the strength of a missing row is not this script's call. Those are reported so
 * somebody can look.
 *
 * @example
 * 	pnpm run data:backfill:nested-block-images
 * 	pnpm run data:backfill:nested-block-images -- --apply
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

interface Candidate {
	contentBlockId: string;
	fieldId: string;
	parentBlockId: string;
	position: number;
	entityId: string;
	entityLabel: string | null;
	entitySlug: string;
	entityType: string;
	status: string;
	parts: Array<SplitPart>;
}

/** Every nested `rich_text` body holding at least one image, already split into what replaces it. */
async function findCandidates(): Promise<Array<Candidate>> {
	const rows = await db
		.select({
			contentBlockId: schema.contentBlocks.id,
			fieldId: schema.contentBlocks.fieldId,
			parentBlockId: schema.contentBlocks.parentBlockId,
			position: schema.contentBlocks.position,
			content: schema.richTextContentBlocks.content,
			entityId: schema.entities.id,
			entityLabel: schema.entities.label,
			entitySlug: schema.slugs.value,
			entityType: schema.entityTypes.type,
			status: schema.entityStatus.type,
		})
		.from(schema.richTextContentBlocks)
		.innerJoin(schema.contentBlocks, eq(schema.contentBlocks.id, schema.richTextContentBlocks.id))
		.innerJoin(schema.fields, eq(schema.fields.id, schema.contentBlocks.fieldId))
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.fields.entityVersionId))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.where(isNotNull(schema.contentBlocks.parentBlockId));

	return rows.flatMap((row) => {
		const parts = splitBody(row.content);

		// Nothing to do unless an image came out: a body that is only prose is already the one block it
		// should be.
		if (!parts.some((part) => part.kind === "image")) {
			return [];
		}

		return [
			{
				contentBlockId: row.contentBlockId,
				fieldId: row.fieldId,
				parentBlockId: row.parentBlockId!,
				position: row.position,
				entityId: row.entityId,
				entityLabel: row.entityLabel,
				entitySlug: row.entitySlug,
				entityType: row.entityType,
				status: row.status,
				parts,
			},
		];
	});
}

/**
 * Rewrites one body into the blocks it splits into.
 *
 * The container's other children are renumbered around them: the parts take positions starting
 * where the old block sat, and everything after it shifts up by however many blocks were added.
 * Sibling order is the only thing `position` means, so this preserves exactly what the author
 * sees.
 */
async function applyCandidate(
	candidate: Candidate,
	typeIds: { image: string; richText: string },
	assetIdsByKey: Map<string, string>,
): Promise<{ written: number; unresolvedKeys: Array<string> }> {
	const { parts: resolved, unresolvedKeys } = planCandidateRewrite(candidate.parts, assetIdsByKey);

	if (!resolved.some((part) => part.kind === "image")) {
		return { written: 0, unresolvedKeys };
	}

	await db.transaction(async (tx) => {
		const siblings = await tx
			.select({ id: schema.contentBlocks.id, position: schema.contentBlocks.position })
			.from(schema.contentBlocks)
			.where(eq(schema.contentBlocks.parentBlockId, candidate.parentBlockId));

		// Shift the later siblings out of the way first, so the new positions are free. One update per
		// row: an update whose `where` reads the same column it writes cannot be trusted to see the
		// rows a sibling statement moved.
		const shift = resolved.length - 1;
		if (shift > 0) {
			for (const sibling of siblings) {
				if (sibling.position > candidate.position) {
					await tx
						.update(schema.contentBlocks)
						.set({ position: sibling.position + shift })
						.where(eq(schema.contentBlocks.id, sibling.id));
				}
			}
		}

		// The old body goes; its typed row cascades with it.
		await tx
			.delete(schema.contentBlocks)
			.where(eq(schema.contentBlocks.id, candidate.contentBlockId));

		for (const [index, part] of resolved.entries()) {
			const [added] = await tx
				.insert(schema.contentBlocks)
				.values({
					fieldId: candidate.fieldId,
					typeId: part.kind === "image" ? typeIds.image : typeIds.richText,
					parentBlockId: candidate.parentBlockId,
					position: candidate.position + index,
				})
				.returning({ id: schema.contentBlocks.id });
			assert(added);

			if (part.kind === "image") {
				const imageId = assetIdsByKey.get(part.imageKey);
				assert(imageId);

				await tx.insert(schema.imageContentBlocks).values({
					id: added.id,
					imageId,
					caption: part.caption,
					captionMode: part.captionMode,
					layout: part.layout,
				});
			} else {
				await tx
					.insert(schema.richTextContentBlocks)
					.values({ id: added.id, content: part.content });
			}
		}
	});

	return { written: resolved.length, unresolvedKeys };
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	log.info(
		apply
			? "Splitting images out of container bodies..."
			: "Finding images inside container bodies (dry run)...",
	);

	const candidates = await findCandidates();
	const imageCount = candidates.reduce(
		(total, candidate) => total + candidate.parts.filter((part) => part.kind === "image").length,
		0,
	);
	const affectedEntities = new Set(candidates.map((candidate) => candidate.entityId)).size;

	log.success(
		`Found ${String(imageCount)} image(s) in ${String(candidates.length)} container body/bodies across ${String(affectedEntities)} entity/entities.`,
	);

	for (const candidate of candidates) {
		log.info(
			`  ${candidate.entityType}/${candidate.entitySlug} (${candidate.status}): ${String(
				candidate.parts.filter((part) => part.kind === "image").length,
			)} image(s)`,
		);
	}

	if (!apply || candidates.length === 0) {
		return;
	}

	const keys = [
		...new Set(
			candidates.flatMap((candidate) =>
				candidate.parts.flatMap((part) => (part.kind === "image" ? [part.imageKey] : [])),
			),
		),
	];
	const assets = await db
		.select({ id: schema.assets.id, key: schema.assets.key })
		.from(schema.assets)
		.where(inArray(schema.assets.key, keys));
	const assetIdsByKey = new Map(assets.map((asset) => [asset.key, asset.id]));

	const types = await db
		.select({ id: schema.contentBlockTypes.id, type: schema.contentBlockTypes.type })
		.from(schema.contentBlockTypes)
		.where(and(inArray(schema.contentBlockTypes.type, ["image", "rich_text"])));
	const imageTypeId = types.find((type) => type.type === "image")?.id;
	const richTextTypeId = types.find((type) => type.type === "rich_text")?.id;
	assert(imageTypeId);
	assert(richTextTypeId);

	let writtenBlocks = 0;
	const unresolved = new Set<string>();

	for (const candidate of candidates) {
		const result = await applyCandidate(
			candidate,
			{ image: imageTypeId, richText: richTextTypeId },
			assetIdsByKey,
		);
		writtenBlocks += result.written;
		for (const key of result.unresolvedKeys) {
			unresolved.add(key);
		}
	}

	log.info(
		`Wrote ${String(writtenBlocks)} block(s) in place of ${String(candidates.length)} body/bodies.`,
	);

	if (unresolved.size > 0) {
		log.warn(
			`${String(unresolved.size)} image key(s) name no asset and were left in the document: ${[...unresolved].join(", ")}`,
		);
	}
}

try {
	await main();
} catch (error) {
	log.error(error);
	process.exitCode = 1;
} finally {
	await db.$client.end().catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	});
}
