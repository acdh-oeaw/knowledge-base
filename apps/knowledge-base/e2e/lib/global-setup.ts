// oxlint-disable node/no-process-env

import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { log } from "@acdh-oeaw/lib";
import { config as dotenv } from "@dotenvx/dotenvx";

// Relative, like the `./fixtures/database-service` import below: this module is loaded by Playwright
// before any tsconfig path aliases are needed.
import { impersonationAdmin } from "./fixtures/impersonation";

dotenv({
	path: [".env.test.local", ".env.local", ".env.test", ".env"].map((filePath) =>
		join(import.meta.dirname, "../..", filePath),
	),
	ignore: ["MISSING_ENV_FILE"],
	quiet: true,
});

const E2E_ADMIN_EMAIL = "e2e-admin@example.com";
const E2E_ADMIN_NAME = "E2E Admin";
const E2E_NON_ADMIN_EMAIL = "e2e-user@example.com";
const E2E_NON_ADMIN_NAME = "E2E User";

/**
 * Relation-derived reporting personas. Unlike `admin`/`non-admin` (which are plain `users.role`
 * values), NC / WG-chair / reporter authority is derived in `lib/auth/permissions.ts` from active
 * `persons_to_organisational_units` relations on the report's org unit. Each persona therefore gets
 * a dedicated (bare) person document linked via `users.person_document_id`, plus active relations
 * to the first published country / working group — the same units the e2e DB helpers resolve, so a
 * report seeded against them authorizes for the persona.
 */
const E2E_NC_EMAIL = "e2e-nc@example.com";
const E2E_NC_NAME = "E2E National Coordinator";
const E2E_WG_CHAIR_EMAIL = "e2e-wgchair@example.com";
const E2E_WG_CHAIR_NAME = "E2E Working Group Chair";
const E2E_REPORTER_EMAIL = "e2e-reporter@example.com";
const E2E_REPORTER_NAME = "E2E Reporter";
const E2E_TEST_ASSET_KEYS: Array<{ key: string; label: string; mimeType?: string }> = [
	{ key: "avatars/e2e-test-asset", label: "E2E Test Asset" },
	{ key: "images/e2e-test-asset", label: "E2E Test Asset" },
	{ key: "logos/e2e-test-asset", label: "E2E Test Asset" },
	{ key: "documents/e2e-test-document", label: "E2E Test Document", mimeType: "application/pdf" },
	/** A second document, so a document link has somewhere else to be pointed at. */
	{
		key: "documents/e2e-other-document",
		label: "E2E Other Document",
		mimeType: "application/pdf",
	},
];
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

function encrypt(data: Buffer, key: Buffer): Buffer {
	const iv = randomBytes(16);
	const cipher = createCipheriv("aes-128-gcm", key, iv);
	return Buffer.concat([iv, cipher.update(data), cipher.final(), cipher.getAuthTag()]);
}

function hashSessionSecret(secret: string): Buffer {
	return createHash("sha-256").update(secret).digest();
}

// eslint-disable-next-line import-x/no-default-export
export default async function globalSetup(): Promise<void> {
	const authEncryptionKeyHex = process.env.AUTH_ENCRYPTION_KEY;
	if (authEncryptionKeyHex?.length !== 32) {
		throw new Error("AUTH_ENCRYPTION_KEY must be a 32-character hex string (16 bytes)");
	}
	const encryptionKey = Buffer.from(authEncryptionKeyHex, "hex");

	const [{ and, eq, sql }, { createDatabaseService }, schema] = await Promise.all([
		import("@dariah-eric/database/sql"),
		import("@dariah-eric/database"),
		import("@dariah-eric/database/schema"),
	]);

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
		/**
		 * Upserts a user and writes a freshly-minted session for them to `<authDir>/<storageFile>`. The
		 * `passwordHash` is a placeholder — we bypass password auth in e2e tests by injecting a
		 * pre-authenticated session directly into the database.
		 */
		async function upsertUserAndWriteSession(input: {
			email: string;
			name: string;
			role: "admin" | "user";
			canManageAdmins: boolean;
			storageFile: string;
			/** Document id of the user's person actor (the relation-based reporting personas). */
			personDocumentId?: string;
		}): Promise<void> {
			const passwordHash = `e2e-placeholder-${randomBytes(16).toString("hex")}`;
			const twoFactorTotpKey = encrypt(randomBytes(20), encryptionKey);
			const twoFactorRecoveryCode = encrypt(
				Buffer.from("E2ETESTRECOVERYCODE1", "utf-8"),
				encryptionKey,
			);

			let existingUser = await db.query.users.findFirst({
				where: { email: input.email },
				columns: { id: true },
			});

			if (existingUser == null) {
				const [inserted] = await db
					.insert(schema.users)
					.values({
						email: input.email,
						name: input.name,
						passwordHash,
						role: input.role,
						canManageAdmins: input.canManageAdmins,
						isEmailVerified: true,
						twoFactorTotpKey,
						twoFactorRecoveryCode,
						personDocumentId: input.personDocumentId,
					})
					.returning({ id: schema.users.id });
				existingUser = inserted;
			} else {
				await db
					.update(schema.users)
					.set({
						role: input.role,
						canManageAdmins: input.canManageAdmins,
						isEmailVerified: true,
						twoFactorTotpKey,
						personDocumentId: input.personDocumentId ?? null,
					})
					.where(eq(schema.users.id, existingUser.id));
			}

			if (existingUser == null) {
				throw new Error(`Failed to create or find the test user "${input.email}"`);
			}

			const userId = existingUser.id;

			await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));

			const sessionId = randomBytes(32).toString("hex");
			const sessionSecret = randomBytes(32).toString("hex");
			const sessionSecretHash = hashSessionSecret(sessionSecret);
			const sessionToken = `${sessionId}.${sessionSecret}`;
			const sessionExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);

			await db.insert(schema.sessions).values({
				id: sessionId,
				secretHash: sessionSecretHash,
				userId,
				expiresAt: sessionExpiresAt,
				isTwoFactorVerified: true,
			});

			const baseUrl =
				process.env.NEXT_PUBLIC_APP_BASE_URL ?? `http://localhost:${process.env.PORT ?? "3001"}`;
			const url = new URL(baseUrl);

			const storageState = {
				cookies: [
					{
						name: "session",
						value: sessionToken,
						domain: url.hostname,
						path: "/",
						expires: Math.floor(sessionExpiresAt.getTime() / 1000),
						httpOnly: true,
						secure: url.protocol === "https:",
						sameSite: "Lax" as const,
					},
				],
				origins: [] as Array<never>,
			};

			const authDir = join(import.meta.dirname, "../.auth");
			await mkdir(authDir, { recursive: true });
			await writeFile(
				join(authDir, input.storageFile),
				JSON.stringify(storageState, null, 2),
				"utf-8",
			);

			log.info(`[globalSetup] Session written for ${input.email} (role=${input.role})`);
		}

		/** First published org-unit document of a given type — matches the e2e DB `get*Option` helpers. */
		async function getFirstPublishedOrgUnitDocument(
			unitType: "country" | "working_group",
		): Promise<{ documentId: string }> {
			const [row] = await db
				.select({ documentId: schema.entityVersions.entityId })
				.from(schema.organisationalUnits)
				.innerJoin(
					schema.organisationalUnitTypes,
					eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
				)
				.innerJoin(
					schema.entityVersions,
					eq(schema.organisationalUnits.id, schema.entityVersions.id),
				)
				.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
				.where(
					and(
						eq(schema.organisationalUnitTypes.type, unitType),
						eq(schema.entityStatus.type, "published"),
						// Rows left over from a run that died are deleted further below, and the `get*Option`
						// helpers skip them too — seed the personas against a unit that will still be there.
						sql`${schema.organisationalUnits.name} NOT LIKE ${"[e2e-worker-%"}`,
					),
				)
				.orderBy(schema.organisationalUnits.name)
				.limit(1);

			if (row == null) {
				throw new Error(`Expected at least one published ${unitType} for e2e reporting personas.`);
			}

			return row;
		}

		/** Resolves a `person_role_types` id by enum value, seeding the reference row if missing. */
		async function resolveRoleTypeId(
			type: (typeof schema.personRoleTypesEnum)[number],
		): Promise<string> {
			const existing = await db
				.select({ id: schema.personRoleTypes.id })
				.from(schema.personRoleTypes)
				.where(eq(schema.personRoleTypes.type, type))
				.limit(1);
			if (existing[0] != null) {
				return existing[0].id;
			}

			const [inserted] = await db
				.insert(schema.personRoleTypes)
				.values({ type })
				.returning({ id: schema.personRoleTypes.id });
			if (inserted == null) {
				throw new Error(`Failed to seed person role type "${type}".`);
			}
			return inserted.id;
		}

		/**
		 * A bare person _document_ (an `entities` row of type `persons`, no version). Sufficient for
		 * authorization — `hasActiveRelation` and `users.person_document_id` only need a valid
		 * `entities.id` — without polluting public person listings/search with a published version.
		 *
		 * Idempotency keys off the persona's `users.email` rather than a slug: a version-less document
		 * has no row in `slugs` (which requires an `entityVersionId`), so on re-runs we look up the
		 * persona's already-seeded `users.person_document_id` instead of the `entities` row directly.
		 */
		async function upsertPersonDocument(email: string): Promise<string> {
			const existingUser = await db.query.users.findFirst({
				where: { email },
				columns: { personDocumentId: true },
			});
			if (existingUser?.personDocumentId != null) {
				return existingUser.personDocumentId;
			}

			const personsEntityType = await db
				.select({ id: schema.entityTypes.id })
				.from(schema.entityTypes)
				.where(eq(schema.entityTypes.type, "persons"))
				.limit(1);
			if (personsEntityType[0] == null) {
				throw new Error('Missing "persons" entity type — cannot seed reporting personas.');
			}
			const personsEntityTypeId = personsEntityType[0].id;

			const [inserted] = await db
				.insert(schema.entities)
				.values({ typeId: personsEntityTypeId })
				.returning({ id: schema.entities.id });
			if (inserted == null) {
				throw new Error(`Failed to create person document for "${email}".`);
			}
			return inserted.id;
		}

		/**
		 * Replaces a persona person's relations with the given active ones. Deleting first keeps the
		 * setup idempotent across runs and avoids tripping the `persons_to_organisational_units`
		 * duration exclusion constraint on re-seed.
		 */
		async function seedActiveRelations(
			personDocumentId: string,
			relations: ReadonlyArray<{ organisationalUnitDocumentId: string; roleTypeId: string }>,
		): Promise<void> {
			await db
				.delete(schema.personsToOrganisationalUnits)
				.where(eq(schema.personsToOrganisationalUnits.personDocumentId, personDocumentId));

			const now = Date.now();
			const duration = {
				start: new Date(now - 1000 * 60 * 60 * 24),
				end: new Date(now + 1000 * 60 * 60 * 24 * 365),
			};

			for (const relation of relations) {
				await db.insert(schema.personsToOrganisationalUnits).values({
					personDocumentId,
					organisationalUnitDocumentId: relation.organisationalUnitDocumentId,
					roleTypeId: relation.roleTypeId,
					duration,
				});
			}
		}

		/** Seeds the relation-derived reporting personas (NC, WG chair, reporter). */
		async function seedReportingPersonas(): Promise<void> {
			const [country, workingGroup] = await Promise.all([
				getFirstPublishedOrgUnitDocument("country"),
				getFirstPublishedOrgUnitDocument("working_group"),
			]);

			const [coordinatorRoleId, chairRoleId, memberRoleId, staffRoleId] = await Promise.all([
				resolveRoleTypeId("national_coordinator"),
				resolveRoleTypeId("is_chair_of"),
				resolveRoleTypeId("is_member_of"),
				resolveRoleTypeId("national_coordination_staff"),
			]);

			const ncPerson = await upsertPersonDocument(E2E_NC_EMAIL);
			await upsertUserAndWriteSession({
				email: E2E_NC_EMAIL,
				name: E2E_NC_NAME,
				role: "user",
				canManageAdmins: false,
				storageFile: "nc.json",
				personDocumentId: ncPerson,
			});
			await seedActiveRelations(ncPerson, [
				{ organisationalUnitDocumentId: country.documentId, roleTypeId: coordinatorRoleId },
			]);

			const chairPerson = await upsertPersonDocument(E2E_WG_CHAIR_EMAIL);
			await upsertUserAndWriteSession({
				email: E2E_WG_CHAIR_EMAIL,
				name: E2E_WG_CHAIR_NAME,
				role: "user",
				canManageAdmins: false,
				storageFile: "wgchair.json",
				personDocumentId: chairPerson,
			});
			await seedActiveRelations(chairPerson, [
				{ organisationalUnitDocumentId: workingGroup.documentId, roleTypeId: chairRoleId },
			]);

			// The reporter edits but cannot confirm: a WG *member* (WG reports) and country
			// *coordination staff* (country reports).
			const reporterPerson = await upsertPersonDocument(E2E_REPORTER_EMAIL);
			await upsertUserAndWriteSession({
				email: E2E_REPORTER_EMAIL,
				name: E2E_REPORTER_NAME,
				role: "user",
				canManageAdmins: false,
				storageFile: "reporter.json",
				personDocumentId: reporterPerson,
			});
			await seedActiveRelations(reporterPerson, [
				{ organisationalUnitDocumentId: workingGroup.documentId, roleTypeId: memberRoleId },
				{ organisationalUnitDocumentId: country.documentId, roleTypeId: staffRoleId },
			]);
		}

		for (const { key, label, mimeType } of E2E_TEST_ASSET_KEYS) {
			const existingAsset = await db.query.assets.findFirst({
				where: { key },
				columns: { id: true },
			});

			if (existingAsset == null) {
				await db.insert(schema.assets).values({
					key,
					label,
					mimeType: mimeType ?? "image/jpeg",
				});
			}
		}

		await upsertUserAndWriteSession({
			email: E2E_ADMIN_EMAIL,
			name: E2E_ADMIN_NAME,
			role: "admin",
			canManageAdmins: true,
			storageFile: "admin.json",
		});

		await upsertUserAndWriteSession({
			email: E2E_NON_ADMIN_EMAIL,
			name: E2E_NON_ADMIN_NAME,
			role: "user",
			canManageAdmins: false,
			storageFile: "non-admin.json",
		});

		/**
		 * The `impersonation` project's own admin — see `impersonationAdmin`. Impersonating makes the
		 * session non-admin for as long as it lasts, so it must not be the session every other admin
		 * test is running against.
		 */
		await upsertUserAndWriteSession({
			email: impersonationAdmin.email,
			name: impersonationAdmin.name,
			role: "admin",
			canManageAdmins: true,
			storageFile: impersonationAdmin.storageFile,
		});

		await seedReportingPersonas();

		// Pre-clean any `[e2e-worker-N]`-prefixed rows left behind by a previous run that died
		// before its afterAll could finish, so the leak check in globalTeardown stays meaningful.
		// `DatabaseService` reuses the same pool as `db` above (cached on `globalThis.__db`), so we
		// must NOT close it here — `db.$client.end()` in the outer finally will close the shared
		// pool, and a second `.end()` raises "Called end on pool more than once".
		const { DatabaseService } = await import("./fixtures/database-service");
		const dbService = new DatabaseService();
		await dbService.cleanupAllE2EWorkerLeaks();
		log.info("[globalSetup] Pre-cleaned any leaked e2e-worker rows from prior runs.");
	} finally {
		await db.$client.end();
	}
}
