import { randomBytes, randomUUID } from "node:crypto";

import type { Database } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { describe, expect, it } from "vitest";

import type { Transaction } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { withTransaction } from "@/test/lib/with-transaction";

const { createAuthService } = await import("@dariah-eric/auth");

const sessionDurationMs = 1000 * 60 * 60;
const impersonationDurationMs = 1000 * 60 * 30;

/**
 * The auth service reaches for cookies and email only on flows this suite does not exercise
 * (sign-in, verification); impersonation is pure session state, so both are inert stubs.
 */
function createTestAuthService(tx: Transaction) {
	const cookie = {
		name: "session",
		options: { httpOnly: true, sameSite: "lax", secure: false, path: "/" },
		durationMs: sessionDurationMs,
	} as const;

	return createAuthService({
		config: {
			emailAddress: "noreply@example.com",
			passwords: { length: { min: 8, max: 255 } },
			emailVerificationRequests: { cookie },
			passwordResetSessions: { cookie },
			sessions: { cookie, impersonation: { durationMs: impersonationDurationMs } },
		},
		context: {
			cookies: {
				get: () => Promise.resolve(null),
				set: () => Promise.resolve(),
				delete: () => Promise.resolve(),
			},
			// The suite runs inside a rolled-back transaction, so the service must write through it.
			db: tx as unknown as Database,
			email: { sendEmail: () => Promise.resolve() } as never,
		},
		secrets: { encryptionKey: randomBytes(16) },
	});
}

async function createUser(tx: Transaction, role: "admin" | "user"): Promise<string> {
	const [user] = await tx
		.insert(schema.users)
		.values({
			email: `${randomUUID()}@example.com`,
			name: `test-${role}`,
			passwordHash: "not-a-real-hash",
			twoFactorRecoveryCode: randomBytes(16),
			role,
			isEmailVerified: true,
		})
		.returning({ id: schema.users.id });

	if (user == null) {
		throw new Error("Failed to create test user");
	}

	return user.id;
}

describe("impersonation", () => {
	it("makes the impersonated user the effective user, keeping the admin as the real user", async () => {
		await withTransaction(async (tx) => {
			const auth = createTestAuthService(tx);
			const adminId = await createUser(tx, "admin");
			const targetId = await createUser(tx, "user");
			const session = await auth.createSession(adminId, true);

			await auth.startImpersonation(session.id, targetId);

			const result = await auth.getSession(session.id);

			expect(result.isImpersonating).toBe(true);
			expect(result.user?.id).toBe(targetId);
			expect(result.realUser?.id).toBe(adminId);
			// The effective role is what authorisation reads, so the admin drops to `user` for now.
			expect(result.user?.role).toBe("user");
		});
	});

	it("returns to the admin's own account when stopped", async () => {
		await withTransaction(async (tx) => {
			const auth = createTestAuthService(tx);
			const adminId = await createUser(tx, "admin");
			const targetId = await createUser(tx, "user");
			const session = await auth.createSession(adminId, true);

			await auth.startImpersonation(session.id, targetId);
			await auth.stopImpersonation(session.id);

			const result = await auth.getSession(session.id);

			expect(result.isImpersonating).toBe(false);
			expect(result.user?.id).toBe(adminId);
			expect(result.realUser?.id).toBe(adminId);
		});
	});

	it("refuses to impersonate another admin", async () => {
		await withTransaction(async (tx) => {
			const auth = createTestAuthService(tx);
			const adminId = await createUser(tx, "admin");
			const otherAdminId = await createUser(tx, "admin");
			const session = await auth.createSession(adminId, true);

			await expect(auth.startImpersonation(session.id, otherAdminId)).rejects.toMatchObject({
				reason: "target_is_admin",
			});
		});
	});

	it("refuses when the caller is not an admin", async () => {
		await withTransaction(async (tx) => {
			const auth = createTestAuthService(tx);
			const userId = await createUser(tx, "user");
			const targetId = await createUser(tx, "user");
			const session = await auth.createSession(userId, true);

			await expect(auth.startImpersonation(session.id, targetId)).rejects.toMatchObject({
				reason: "not_admin",
			});
		});
	});

	it("refuses when the admin has not completed two-factor for this session", async () => {
		await withTransaction(async (tx) => {
			const auth = createTestAuthService(tx);
			const adminId = await createUser(tx, "admin");
			const targetId = await createUser(tx, "user");
			const session = await auth.createSession(adminId, false);

			await expect(auth.startImpersonation(session.id, targetId)).rejects.toMatchObject({
				reason: "two_factor_required",
			});
		});
	});

	it("refuses to nest impersonations", async () => {
		await withTransaction(async (tx) => {
			const auth = createTestAuthService(tx);
			const adminId = await createUser(tx, "admin");
			const firstId = await createUser(tx, "user");
			const secondId = await createUser(tx, "user");
			const session = await auth.createSession(adminId, true);

			await auth.startImpersonation(session.id, firstId);

			await expect(auth.startImpersonation(session.id, secondId)).rejects.toMatchObject({
				reason: "already_impersonating",
			});
		});
	});

	it("ends a live impersonation once the admin is demoted", async () => {
		await withTransaction(async (tx) => {
			const auth = createTestAuthService(tx);
			const adminId = await createUser(tx, "admin");
			const targetId = await createUser(tx, "user");
			const session = await auth.createSession(adminId, true);

			await auth.startImpersonation(session.id, targetId);

			await tx.update(schema.users).set({ role: "user" }).where(eq(schema.users.id, adminId));

			const result = await auth.getSession(session.id);

			expect(result.isImpersonating).toBe(false);
			expect(result.user?.id).toBe(adminId);

			// Not merely hidden from the response -- the row itself is cleared.
			const stored = await tx.query.sessions.findFirst({
				where: { id: session.id },
				columns: { impersonatedUserId: true },
			});
			expect(stored?.impersonatedUserId).toBeNull();
		});
	});

	it("ends a live impersonation once the target becomes an admin", async () => {
		await withTransaction(async (tx) => {
			const auth = createTestAuthService(tx);
			const adminId = await createUser(tx, "admin");
			const targetId = await createUser(tx, "user");
			const session = await auth.createSession(adminId, true);

			await auth.startImpersonation(session.id, targetId);

			await tx.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, targetId));

			const result = await auth.getSession(session.id);

			expect(result.isImpersonating).toBe(false);
			expect(result.user?.id).toBe(adminId);
		});
	});

	it("lapses into the admin's own account instead of invalidating the session", async () => {
		await withTransaction(async (tx) => {
			const auth = createTestAuthService(tx);
			const adminId = await createUser(tx, "admin");
			const targetId = await createUser(tx, "user");
			const session = await auth.createSession(adminId, true);

			await auth.startImpersonation(session.id, targetId);

			await tx
				.update(schema.sessions)
				.set({ impersonationExpiresAt: new Date(Date.now() - 1000) })
				.where(eq(schema.sessions.id, session.id));

			const result = await auth.getSession(session.id);

			// Still signed in -- being silently signed out mid-form is worse than being un-impersonated.
			expect(result.session).not.toBeNull();
			expect(result.isImpersonating).toBe(false);
			expect(result.user?.id).toBe(adminId);
		});
	});

	it("ends impersonations of a user when their sessions are revoked", async () => {
		await withTransaction(async (tx) => {
			const auth = createTestAuthService(tx);
			const adminId = await createUser(tx, "admin");
			const targetId = await createUser(tx, "user");
			const session = await auth.createSession(adminId, true);

			await auth.startImpersonation(session.id, targetId);
			await auth.deleteUserSessions(targetId);

			const result = await auth.getSession(session.id);

			expect(result.isImpersonating).toBe(false);
			expect(result.user?.id).toBe(adminId);
		});
	});
});
