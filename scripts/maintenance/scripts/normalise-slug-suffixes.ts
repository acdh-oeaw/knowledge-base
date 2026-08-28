import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { type SQL, and, eq, sql } from "@dariah-eric/database/sql";
import slugify from "@sindresorhus/slugify";

import { env } from "../config/env.config";
import { readTsvReport, writeTsvReport } from "../lib/tsv-report";

/**
 * Drops the numeric dedup suffix from a `slugs.value` where the unsuffixed slug is in fact free —
 * the WordPress migration copied slugs verbatim (`normalizeWordPressSlug`), so items whose slug
 * collided in WordPress carry a `-2` here even though nothing in this database claims the base. Dry
 * run by default; `--apply` renames, `--from-file` renames a reviewed report.
 *
 * A slug is now scoped per (type, locale) rather than per type alone — a document can hold more
 * than one slug row (draft and published, or one per locale) — so both the collision check and the
 * rename are scoped to the candidate's own type and locale. The suffix is only ever dropped, never
 * renumbered: `foo-3` becomes `foo`, and if `foo` is taken it is left alone.
 *
 * A slug is a public URL segment. Renaming one changes that URL and 404s every external link to the
 * old one, and nothing in this repo emits a redirect — that is the trade the report exists to let
 * someone make deliberately, per row.
 *
 * @example
 * 	pnpm run data:normalise:slug-suffixes
 * 	pnpm run data:normalise:slug-suffixes -- --max-suffix=9
 * 	pnpm run data:normalise:slug-suffixes -- --apply
 * 	pnpm run data:normalise:slug-suffixes -- --apply --include-referenced
 * 	pnpm run data:normalise:slug-suffixes -- --apply --from-file=.cache/slug-suffixes.tsv
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "slug-suffixes.tsv");

/**
 * The largest suffix treated as a dedup counter, matching `maxSlugAttempts` in the CMS's
 * `insertDocumentWithFreeSlug` — the other producer of these suffixes, and the one that decides how
 * high they can go.
 *
 * It also keeps years out of the candidate set: a `-2024` is a title, not a counter. The narrower
 * `--max-suffix=9` is worth a thought where the data holds "phase 10"-style titles.
 */
const defaultMaxSuffix = 50;

/**
 * Why a candidate is or is not renamed.
 *
 * `derived` and `free` are written by `--apply`; the rest are reported for a human. The split
 * between them is confidence, not eligibility — both have a free base slug, but `derived` also has
 * a label that slugifies to exactly that base, which is what a dedup suffix looks like from the
 * outside.
 *
 * `title_suffix` is the false positive this script exists to not commit: a "Training Tuesday Part
 * 2" whose slug legitimately ends in `-2`. Its label carries the same number, so the suffix is
 * content rather than a counter, and dropping it would rename the item to something wrong.
 */
type Confidence = "derived" | "free" | "title_suffix" | "collision" | "ambiguous";

const autoAppliableConfidences = new Set<Confidence>(["derived", "free"]);

interface Finding {
	/** Primary key of the `slugs` row this finding targets — a document may carry more than one. */
	slugId: string;
	documentId: string;
	entityType: string;
	typeId: string;
	localeId: string;
	/** The denormalised published label, or `""` for a document that has never been published. */
	label: string;
	currentSlug: string;
	/** The slug without its numeric suffix — the rename target, empty for nothing renameable. */
	baseSlug: string;
	suffix: number;
	confidence: Confidence;
	/** `table.column` of every place a stored link points at `currentSlug`. */
	references: Array<string>;
}

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

/**
 * Splits a trailing `-<n>` off a slug, or returns `null` when there is none to split, when `n` is
 * above `maxSuffix`, or when nothing but the counter would be left (`2-2`).
 *
 * `-1` is not a dedup suffix — neither producer emits it, the first attempt being the bare slug —
 * and `-02` is not one either: a counter is written without padding, so a padded number is part of
 * whatever the slug names.
 */
function splitSlugSuffix(
	slug: string,
	maxSuffix: number,
): { baseSlug: string; suffix: number } | null {
	const match = /^(?<base>.+)-(?<digits>\d+)$/u.exec(slug);
	const base = match?.groups?.base;
	const digits = match?.groups?.digits;

	if (base == null || digits == null || digits.startsWith("0")) {
		return null;
	}

	const suffix = Number(digits);

	if (suffix < 2 || suffix > maxSuffix) {
		return null;
	}

	if (!/[a-z]/iu.test(base)) {
		return null;
	}

	return { baseSlug: base, suffix };
}

/**
 * A label as it compares to a slug. Organisational-unit and project labels are denormalised with
 * their acronym in parentheses (see `entities.label`), which is not in the slug, so it comes off
 * before slugifying.
 */
function labelSlug(label: string): string {
	return slugify(label.replace(/\s*\([^()]*\)\s*$/u, ""));
}

interface CatalogColumn {
	schema: string;
	table: string;
	column: string;
}

function qualifiedTable(column: CatalogColumn): SQL {
	return sql`${sql.identifier(column.schema)}.${sql.identifier(column.table)}`;
}

/**
 * Every column a stored link can sit in: `jsonb` (rich text, content blocks) plus the text columns
 * named like a link. Discovered from the catalog rather than listed, so a column added later is
 * covered without anybody remembering this script.
 *
 * Base tables only. The views (`members_and_partners`, `working_groups`, `dariah_projects`) select
 * the same `metadata` a table already exposes, so scanning them re-scans those rows and reports the
 * hit under a second name.
 */
async function getLinkBearingColumns(): Promise<Array<CatalogColumn>> {
	const result = await db.execute<{
		table_schema: string;
		table_name: string;
		column_name: string;
	}>(sql`
		select c.table_schema, c.table_name, c.column_name
		from information_schema.columns c
		join information_schema.tables t
			on t.table_schema = c.table_schema and t.table_name = c.table_name
		where c.table_schema not in ('pg_catalog', 'information_schema')
			and t.table_type = 'BASE TABLE'
			and (
				c.data_type in ('jsonb', 'json')
				or (c.data_type in ('text', 'character varying') and c.column_name ~ '(href|url|link|path)')
			)
	`);

	return result.rows.map((row) => {
		return { schema: row.table_schema, table: row.table_name, column: row.column_name };
	});
}

/** Escapes a slug for use inside a POSIX regular expression. */
function toRegexLiteral(value: string): string {
	return value.replaceAll(/[^\w]/gu, (character) => `\\${character}`);
}

/**
 * For each slug, where a stored link mentions it as a path segment.
 *
 * A rich-text link that points at one of our documents stores a _reference_ and survives a rename
 * (see `link-targets.ts`), but a plain `href` — everything the WordPress import wrote, everything
 * `data:clean:richtext-links` rewrote to a website route, every hand-typed link — stores the slug
 * as text and does not. Those are the rows a rename silently breaks, so they are found before it
 * happens rather than reported as 404s later.
 *
 * Matched as `/<slug>` up to a path boundary, which covers a root-relative path, a locale-prefixed
 * one and an absolute url alike, and keeps `/foo-2` from matching `/foo-20`. Slugs are matched
 * across types, since a bare path cannot say which type it addresses — an over-count here costs a
 * reviewer a look, an under-count costs a broken link.
 */
async function findReferences(slugs: Array<string>): Promise<Map<string, Array<string>>> {
	const references = new Map<string, Array<string>>();

	if (slugs.length === 0) {
		return references;
	}

	const columns = await getLinkBearingColumns();

	// A scalar `VALUES` list (each slug its own parameter) rather than an array parameter — drizzle
	// expands an array in a template into a tuple `($1, $2, …)`, which cannot be cast to `text[]`.
	// Cast explicitly: `a.slug` is only ever selected, never used in an expression that would settle
	// its type, and an unknown-typed parameter is one Postgres refuses to plan.
	const slugValues = sql.join(
		slugs.map((slug) => sql`(${slug}::text, ${toRegexLiteral(slug)}::text)`),
		sql`, `,
	);

	for (const column of columns) {
		const result = await db.execute<{ slug: string }>(sql`
			select distinct a.slug
			from (values ${slugValues}) as a(slug, pattern)
			where exists (
				select 1 from ${qualifiedTable(column)} as t
				where t.${sql.identifier(column.column)}::text ~ ('/' || a.pattern || '($|[^a-zA-Z0-9-])')
			)
		`);

		for (const row of result.rows) {
			const locations = references.get(row.slug) ?? [];
			locations.push(`${column.table}.${column.column}`);
			references.set(row.slug, locations);
		}
	}

	return references;
}

async function collectFindings(maxSuffix: number): Promise<Array<Finding>> {
	const rows = await db
		.select({
			slugId: schema.slugs.id,
			documentId: schema.entities.id,
			slug: schema.slugs.value,
			label: schema.entities.label,
			typeId: schema.slugs.typeId,
			localeId: schema.slugs.localeId,
			entityType: schema.entityTypes.type,
		})
		.from(schema.slugs)
		.innerJoin(schema.entities, eq(schema.entities.id, schema.slugs.entityId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.slugs.typeId));

	/** Slugs in use per (type, locale) — what a base slug has to be absent from to be free. */
	const slugsByTypeLocale = new Map<string, Set<string>>();

	for (const row of rows) {
		const key = `${row.typeId}/${row.localeId}`;
		const slugs = slugsByTypeLocale.get(key) ?? new Set<string>();
		slugs.add(row.slug);
		slugsByTypeLocale.set(key, slugs);
	}

	const candidates = rows.flatMap((row) => {
		const split = splitSlugSuffix(row.slug, maxSuffix);

		if (split == null) {
			return [];
		}

		return [{ ...row, ...split, label: row.label ?? "" }];
	});

	/**
	 * How many candidates of a (type, locale) want the same base slug. `foo-2` and `foo-3` with `foo`
	 * free can only be settled by a human — whichever the script picked would take a URL from the
	 * other.
	 */
	const claims = new Map<string, number>();

	for (const candidate of candidates) {
		const key = `${candidate.typeId}/${candidate.localeId}/${candidate.baseSlug}`;
		claims.set(key, (claims.get(key) ?? 0) + 1);
	}

	const references = await findReferences(candidates.map((candidate) => candidate.slug));

	return candidates.map((candidate) => {
		const taken =
			slugsByTypeLocale
				.get(`${candidate.typeId}/${candidate.localeId}`)
				?.has(candidate.baseSlug) === true;
		const claimed =
			(claims.get(`${candidate.typeId}/${candidate.localeId}/${candidate.baseSlug}`) ?? 0) > 1;
		const normalisedLabel = candidate.label === "" ? "" : labelSlug(candidate.label);

		const confidence: Confidence = taken
			? "collision"
			: claimed
				? "ambiguous"
				: normalisedLabel.endsWith(`-${String(candidate.suffix)}`)
					? "title_suffix"
					: normalisedLabel === candidate.baseSlug
						? "derived"
						: "free";

		return {
			slugId: candidate.slugId,
			documentId: candidate.documentId,
			entityType: candidate.entityType,
			typeId: candidate.typeId,
			localeId: candidate.localeId,
			label: candidate.label,
			currentSlug: candidate.slug,
			baseSlug: candidate.baseSlug,
			suffix: candidate.suffix,
			confidence,
			references: references.get(candidate.slug) ?? [],
		};
	});
}

const reportColumns = [
	"confidence",
	"entity_type",
	"document_id",
	"label",
	"current_slug",
	"new_slug",
	"references",
] as const;

async function writeReport(findings: Array<Finding>): Promise<void> {
	const order: Record<Confidence, number> = {
		derived: 0,
		free: 1,
		title_suffix: 2,
		ambiguous: 3,
		collision: 4,
	};

	const rows = findings
		.toSorted(
			(a, b) =>
				order[a.confidence] - order[b.confidence] ||
				a.entityType.localeCompare(b.entityType) ||
				a.currentSlug.localeCompare(b.currentSlug),
		)
		.map((finding) => [
			finding.confidence,
			finding.entityType,
			finding.documentId,
			finding.label,
			finding.currentSlug,
			// Blank where the script will not rename, so a reviewer opts in by filling it in.
			autoAppliableConfidences.has(finding.confidence) ? finding.baseSlug : "",
			finding.references.join(", "),
		]);

	await writeTsvReport(reportFilePath, reportColumns, rows);
}

/**
 * Reads back a report a human has edited. Only `document_id` and `new_slug` are read: clearing the
 * slug rejects a row, filling one in accepts a row the script would not have renamed on its own.
 *
 * A reviewed slug is held to the same rules as a proposed one — slugified, free within the type and
 * locale — because the file is edited in a spreadsheet, where "Foo 2" is an easy thing to type into
 * a column that ends up in a URL. `--include-referenced` is not consulted here: naming a row
 * explicitly is the decision that flag otherwise stands in for.
 *
 * Keyed by `document_id`, so a document that carries more than one suffixed slug (draft and
 * published, or more than one locale) only keeps the last matching finding here. Not expected in
 * practice: the suffixes this script targets are leftovers from the single-locale WordPress
 * import.
 */
async function readReviewedRenames(
	filePath: string,
	findings: Array<Finding>,
): Promise<Array<Finding>> {
	const records = await readTsvReport(filePath, ["document_id", "new_slug"]);

	const findingsByDocumentId = new Map(findings.map((finding) => [finding.documentId, finding]));

	return records.flatMap((record) => {
		const documentId = record.document_id ?? "";
		const requested = record.new_slug ?? "";

		if (documentId === "" || requested === "") {
			return [];
		}

		const finding = findingsByDocumentId.get(documentId);

		/**
		 * A row for a document that no longer carries a suffixed slug is skipped, not force-applied: it
		 * means the slug was changed, or the document deleted, since the report was written.
		 */
		if (finding == null) {
			log.warn(`Skipping reviewed row for "${documentId}": no longer a candidate.`);
			return [];
		}

		const slug = slugify(requested);

		if (slug !== requested) {
			log.warn(
				`Skipping reviewed row for "${finding.currentSlug}": "${requested}" is not a slug (did you mean "${slug}"?).`,
			);
			return [];
		}

		return [{ ...finding, baseSlug: slug }];
	});
}

/**
 * Renames, re-checking each row against the database inside the transaction. The report is a file
 * on disk that may be hours old, and the check it encodes — "this base slug is free" — is exactly
 * the kind another editor invalidates by publishing something.
 */
async function applyRenames(renames: Array<Finding>): Promise<number> {
	let applied = 0;

	await db.transaction(async (tx) => {
		for (const rename of renames) {
			const [current] = await tx
				.select({
					slug: schema.slugs.value,
					typeId: schema.slugs.typeId,
					localeId: schema.slugs.localeId,
				})
				.from(schema.slugs)
				.where(eq(schema.slugs.id, rename.slugId))
				.limit(1);

			if (current == null || current.slug !== rename.currentSlug) {
				log.warn(`Skipping "${rename.currentSlug}": slug changed since the report was written.`);
				continue;
			}

			const [taken] = await tx
				.select({ id: schema.slugs.id })
				.from(schema.slugs)
				.where(
					and(
						eq(schema.slugs.typeId, current.typeId),
						eq(schema.slugs.localeId, current.localeId),
						eq(schema.slugs.value, rename.baseSlug),
					),
				)
				.limit(1);

			if (taken != null) {
				log.warn(`Skipping "${rename.currentSlug}": "${rename.baseSlug}" is taken.`);
				continue;
			}

			await tx
				.update(schema.slugs)
				.set({ value: rename.baseSlug })
				.where(eq(schema.slugs.id, rename.slugId));

			applied += 1;
		}
	});

	return applied;
}

function summarise(findings: Array<Finding>): string {
	const counts = new Map<Confidence, number>();

	for (const finding of findings) {
		counts.set(finding.confidence, (counts.get(finding.confidence) ?? 0) + 1);
	}

	return [...counts]
		.toSorted(([a], [b]) => a.localeCompare(b))
		.map(([confidence, count]) => `${confidence}: ${String(count)}`)
		.join(", ");
}

function reportRenames(applied: number): void {
	log.success(`Renamed ${String(applied)} slug(s).`);

	if (applied > 0) {
		log.info("Public urls changed — rebuild the website and re-run `data:ingest:search`.");
	}
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");
	const includeReferenced = process.argv.includes("--include-referenced");
	const fromFile = process.argv
		.find((argument) => argument.startsWith("--from-file="))
		?.slice("--from-file=".length);
	const maxSuffixArgument = process.argv
		.find((argument) => argument.startsWith("--max-suffix="))
		?.slice("--max-suffix=".length);

	const maxSuffix = maxSuffixArgument == null ? defaultMaxSuffix : Number(maxSuffixArgument);

	if (!Number.isInteger(maxSuffix) || maxSuffix < 2) {
		throw new Error(`Invalid \`--max-suffix\`: "${String(maxSuffixArgument)}".`);
	}

	log.info(
		apply
			? "Dropping redundant numeric slug suffixes..."
			: "Finding redundant numeric slug suffixes (dry run)...",
	);

	const findings = await collectFindings(maxSuffix);

	log.success(
		findings.length === 0
			? "No suffixed slugs."
			: `${String(findings.length)} suffixed slug(s) — ${summarise(findings)}.`,
	);

	/**
	 * A run that reads a reviewed report writes no report. `--from-file` is normally pointed at the
	 * file this script wrote, so refreshing it first would overwrite the reviewer's `new_slug` column
	 * with a fresh proposal and then read that back as if a human had chosen it.
	 */
	if (fromFile != null) {
		const reviewed = await readReviewedRenames(fromFile, findings);

		if (!apply) {
			log.info(`${String(reviewed.length)} reviewed rename(s). Pass \`--apply\` to write them.`);
			return;
		}

		const applied = await applyRenames(reviewed);
		reportRenames(applied);
		return;
	}

	await writeReport(findings);
	log.info(`Report: ${reportFilePath}`);

	const appliable = findings.filter((finding) => autoAppliableConfidences.has(finding.confidence));
	const referenced = appliable.filter((finding) => finding.references.length > 0);
	const renames = includeReferenced
		? appliable
		: appliable.filter((finding) => finding.references.length === 0);

	if (referenced.length > 0) {
		log.warn(
			`${String(referenced.length)} renameable slug(s) are linked to by a stored href and are ${
				includeReferenced ? "renamed anyway (`--include-referenced`)" : "held back"
			} — see the \`references\` column.`,
		);
	}

	if (!apply) {
		log.info(
			`${String(renames.length)} slug(s) would be renamed. Pass \`--apply\` to write them, or review the report and re-run with \`--apply --from-file=${reportFilePath}\`.`,
		);
		return;
	}

	const applied = await applyRenames(renames);

	reportRenames(applied);
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
