import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { eq } from "drizzle-orm";

import { apiBaseUrl } from "../config/data-migration.config";
import { env } from "../config/env.config";
import { getEventDuration, getEvents } from "../src/lib/get-wordpress-data";
import { normalizeWordPressSlug, toPlaintext } from "../src/lib/migrate-wordpress-content";

/**
 * The bulk `migrate-wordpress.ts` import derived event `duration` from `utc_start_date` /
 * `utc_end_date` (the UTC instant), so all-day and evening events were stored one day early once
 * displayed under the app's global `timeZone: "UTC"`. This script re-derives every event's duration
 * via `getEventDuration` from the WordPress event's local wall-clock (`start_date` / `end_date`,
 * treated as UTC — the UTC-as-standin-for-local convention, matching what The Events Calendar
 * shows; all-day events normalized to UTC midnight, single-day all-day left open-ended). It matches
 * events by slug, is idempotent (unchanged durations are skipped) and preserves each row's
 * `updated_at`.
 *
 * Usage: `pnpm run data:migrate:fix-event-durations [--dry-run]`
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

function sameInstant(a: Date | undefined, b: Date | undefined): boolean {
	if (a == null || b == null) {
		return a == null && b == null;
	}
	return a.getTime() === b.getTime();
}

async function main() {
	const dryRun = process.argv.includes("--dry-run");

	const wpEvents = await getEvents(apiBaseUrl);
	log.info(`Fetched ${String(wpEvents.length)} events from WordPress.`);

	const durationBySlug = new Map<string, { start: Date; end: Date | undefined }>();
	for (const event of wpEvents) {
		const slug = normalizeWordPressSlug(event.slug, toPlaintext(event.title));
		durationBySlug.set(slug, getEventDuration(event));
	}

	const rows = await db
		.select({
			id: schema.events.id,
			slug: schema.slugs.value,
			duration: schema.events.duration,
			updatedAt: schema.events.updatedAt,
		})
		.from(schema.events)
		.innerJoin(schema.entityVersions, eq(schema.events.id, schema.entityVersions.id))
		.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id));

	let changed = 0;
	let unchanged = 0;
	let unmatched = 0;

	for (const row of rows) {
		const correct = durationBySlug.get(row.slug);

		if (correct == null) {
			log.warn(`No WordPress event found for slug "${row.slug}". Skipping.`);
			unmatched += 1;
			continue;
		}

		if (
			sameInstant(row.duration.start, correct.start) &&
			sameInstant(row.duration.end, correct.end)
		) {
			unchanged += 1;
			continue;
		}

		log.info(`"${row.slug}": ${row.duration.start.toISOString()} → ${correct.start.toISOString()}`);

		if (!dryRun) {
			// Pass `updatedAt` explicitly so the `$onUpdate` hook does not bump it — this is a
			// correction of migrated data, not an editorial change.
			await db
				.update(schema.events)
				.set({ duration: correct, updatedAt: row.updatedAt })
				.where(eq(schema.events.id, row.id));
		}

		changed += 1;
	}

	log.info(
		`${dryRun ? "[dry run] would fix" : "Fixed"} ${String(changed)} event duration(s); ${String(unchanged)} already correct, ${String(unmatched)} unmatched.`,
	);
}

main()
	.catch((error: unknown) => {
		log.error("Failed to fix event durations.", error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises
	.finally(() =>
		// oxlint-disable-next-line typescript/strict-void-return
		db.$client.end().catch((error: unknown) => {
			log.error("Failed to close database connection.\n", error);
			process.exitCode = 1;
		}),
	);
