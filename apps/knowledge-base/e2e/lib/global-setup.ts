// oxlint-disable node/no-process-env

import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { log } from "@acdh-oeaw/lib";
import { config as dotenv } from "@dotenvx/dotenvx";

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
const E2E_TEST_ASSET_KEYS: Array<{ key: string; label: string; mimeType?: string }> = [
	{ key: "avatars/e2e-test-asset", label: "E2E Test Asset" },
	{ key: "images/e2e-test-asset", label: "E2E Test Asset" },
	{ key: "logos/e2e-test-asset", label: "E2E Test Asset" },
	{ key: "documents/e2e-test-document", label: "E2E Test Document", mimeType: "application/pdf" },
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

	const [{ eq }, { createDatabaseService }, schema] = await Promise.all([
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
