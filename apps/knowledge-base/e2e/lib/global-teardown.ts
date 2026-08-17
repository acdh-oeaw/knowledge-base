// oxlint-disable node/no-process-env

import { join } from "node:path";

import { log } from "@acdh-oeaw/lib";
import type { Database } from "@dariah-eric/database";
import type * as SchemaModule from "@dariah-eric/database/schema";
import type { sql as SqlFn } from "@dariah-eric/database/sql";
import { config as dotenv } from "@dotenvx/dotenvx";

dotenv({
	path: [".env.test.local", ".env.local", ".env.test", ".env"].map((filePath) =>
		join(import.meta.dirname, "../..", filePath),
	),
	ignore: ["MISSING_ENV_FILE"],
	quiet: true,
});

const PREFIX_PATTERN = "[e2e-worker-%";

interface LeakCheck {
	label: string;
	query: (
		db: Database,
		schema: typeof SchemaModule,
		sql: typeof SqlFn,
	) => Promise<Array<{ identifier: string }>>;
}

const checks: ReadonlyArray<LeakCheck> = [
	{
		label: "persons",
		query: (db, schema, sql) =>
			db
				.select({ identifier: schema.persons.name })
				.from(schema.persons)
				.where(sql`${schema.persons.name} LIKE ${PREFIX_PATTERN}`),
	},
	{
		label: "projects",
		query: (db, schema, sql) =>
			db
				.select({ identifier: schema.projects.name })
				.from(schema.projects)
				.where(sql`${schema.projects.name} LIKE ${PREFIX_PATTERN}`),
	},
	{
		label: "pages",
		query: (db, schema, sql) =>
			db
				.select({ identifier: schema.pages.title })
				.from(schema.pages)
				.where(sql`${schema.pages.title} LIKE ${PREFIX_PATTERN}`),
	},
	{
		label: "impact case studies",
		query: (db, schema, sql) =>
			db
				.select({ identifier: schema.impactCaseStudies.title })
				.from(schema.impactCaseStudies)
				.where(sql`${schema.impactCaseStudies.title} LIKE ${PREFIX_PATTERN}`),
	},
	{
		label: "spotlight articles",
		query: (db, schema, sql) =>
			db
				.select({ identifier: schema.spotlightArticles.title })
				.from(schema.spotlightArticles)
				.where(sql`${schema.spotlightArticles.title} LIKE ${PREFIX_PATTERN}`),
	},
	{
		label: "events",
		query: (db, schema, sql) =>
			db
				.select({ identifier: schema.events.title })
				.from(schema.events)
				.where(sql`${schema.events.title} LIKE ${PREFIX_PATTERN}`),
	},
	{
		label: "news",
		query: (db, schema, sql) =>
			db
				.select({ identifier: schema.news.title })
				.from(schema.news)
				.where(sql`${schema.news.title} LIKE ${PREFIX_PATTERN}`),
	},
	{
		label: "organisational units",
		query: (db, schema, sql) =>
			db
				.select({ identifier: schema.organisationalUnits.name })
				.from(schema.organisationalUnits)
				.where(sql`${schema.organisationalUnits.name} LIKE ${PREFIX_PATTERN}`),
	},
	{
		label: "services",
		query: (db, schema, sql) =>
			db
				.select({ identifier: schema.services.name })
				.from(schema.services)
				.where(sql`${schema.services.name} LIKE ${PREFIX_PATTERN}`),
	},
	{
		label: "social media",
		query: (db, schema, sql) =>
			db
				.select({ identifier: schema.socialMedia.name })
				.from(schema.socialMedia)
				.where(sql`${schema.socialMedia.name} LIKE ${PREFIX_PATTERN}`),
	},
	{
		label: "users",
		query: (db, schema, sql) =>
			db
				.select({ identifier: schema.users.name })
				.from(schema.users)
				.where(sql`${schema.users.name} LIKE ${PREFIX_PATTERN}`),
	},
	{
		label: "assets",
		query: (db, schema, sql) =>
			db
				.select({ identifier: schema.assets.label })
				.from(schema.assets)
				.where(sql`${schema.assets.label} LIKE ${PREFIX_PATTERN}`),
	},
];

// eslint-disable-next-line import-x/no-default-export
export default async function globalTeardown(): Promise<void> {
	const [{ createDatabaseService }, schema, { sql }] = await Promise.all([
		import("@dariah-eric/database"),
		import("@dariah-eric/database/schema"),
		import("@dariah-eric/database/sql"),
	]);

	/**
	 * `createDatabaseService` caches the pool on `globalThis.__db`. Playwright runs globalSetup and
	 * globalTeardown in the same Node process, so the cache survives — and globalSetup already called
	 * `.end()` on it. Reset the cache so we get a fresh pool we can use and own.
	 */
	globalThis.__db = undefined;

	const db = createDatabaseService({
		connection: {
			database: process.env.DATABASE_NAME,
			host: process.env.DATABASE_HOST,
			password: process.env.DATABASE_PASSWORD,
			port: Number(process.env.DATABASE_PORT),
			user: process.env.DATABASE_USER,
		},
		logger: false,
	}).unwrap();

	try {
		const leaks: Array<{ label: string; identifiers: Array<string> }> = [];

		for (const check of checks) {
			const rows = await check.query(db, schema, sql);
			if (rows.length > 0) {
				leaks.push({
					label: check.label,
					identifiers: rows.map((row) => row.identifier),
				});
			}
		}

		if (leaks.length === 0) {
			log.info("[globalTeardown] No leaked e2e-worker rows detected.");
			return;
		}

		const summary = leaks
			.map(
				({ label, identifiers }) =>
					`  - ${label} (${String(identifiers.length)}):\n${identifiers
						.map((id) => `      ${id}`)
						.join("\n")}`,
			)
			.join("\n");

		throw new Error(
			`[globalTeardown] Leaked e2e-worker rows found — afterAll cleanup did not run to completion.\n${summary}`,
		);
	} finally {
		await db.$client.end();
	}
}
