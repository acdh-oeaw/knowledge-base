import assert from "node:assert";
import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	timingSafeEqual,
} from "node:crypto";

import { createUrl } from "@acdh-oeaw/lib";
import type { Database } from "@dariah-eric/database";
import { DatabaseError } from "@dariah-eric/database/errors";
import * as schema from "@dariah-eric/database/schema";
import { and, eq, sql } from "@dariah-eric/database/sql";
import type { EmailService } from "@dariah-eric/email";
import { ExpiringTokenBucket, RefillingTokenBucket, Throttler } from "@dariah-eric/rate-limiter";
import { request } from "@dariah-eric/request";
import { hash, verify } from "@node-rs/argon2";
import { decodeBase64, encodeBase32UpperCaseNoPadding, encodeBase64 } from "@oslojs/encoding";
import { createTOTPKeyURI, verifyTOTP } from "@oslojs/otp";

import { InvalidUserIdError } from "./errors";

interface CookieConfig {
	name: string;
	options: {
		httpOnly: true;
		sameSite: "lax" | "strict";
		secure: boolean;
		path: string;
	};
	durationMs: number;
}

interface AuthServiceConfig {
	emailAddress: string;
	passwords: {
		length: {
			min: number;
			max: number;
		};
	};
	emailVerificationRequests: {
		cookie: CookieConfig;
	};
	passwordResetSessions: {
		cookie: CookieConfig;
	};
	sessions: {
		cookie: CookieConfig;
	};
}

interface CookieService {
	get: (name: string) => Promise<string | null>;
	set: (
		name: string,
		value: string,
		cookie: {
			expires: Date;
			httpOnly: true;
			path: string;
			sameSite: "lax" | "strict";
			secure: boolean;
		},
	) => Promise<void>;
	delete: (name: string) => Promise<void>;
}

interface CreateAuthServiceParams {
	config: AuthServiceConfig;
	secrets: {
		encryptionKey: Buffer;
	};
	context: {
		cookies: CookieService;
		db: Database;
		email: EmailService;
	};
}

export interface User extends Pick<
	schema.User,
	| "id"
	| "email"
	| "name"
	| "role"
	| "canManageAdmins"
	| "isEmailVerified"
	| "personDocumentId"
	| "organisationalUnitDocumentId"
> {
	isTwoFactorRegistered: boolean;
}

export interface Session extends Pick<
	schema.Session,
	"id" | "secretHash" | "expiresAt" | "isTwoFactorVerified"
> {}

export interface AuthenticatedSession {
	session: Session;
	user: User;
}

export interface UnauthenticatedSession {
	session: null;
	user: null;
}

export type SessionValidationResult = AuthenticatedSession | UnauthenticatedSession;

export interface EmailVerificationRequest extends Pick<
	schema.EmailVerificationRequest,
	"id" | "code" | "email" | "expiresAt" | "userId"
> {}

export interface PasswordResetSession extends Pick<
	schema.PasswordResetSession,
	"id" | "userId" | "email" | "code" | "expiresAt" | "isEmailVerified" | "isTwoFactorVerified"
> {}

export interface AuthenticatedPasswordResetSession {
	session: PasswordResetSession;
	user: User;
}

export interface UnauthenticatedPasswordResetSession {
	session: null;
	user: null;
}

export type PasswordResetSessionValidationResult =
	| AuthenticatedPasswordResetSession
	| UnauthenticatedPasswordResetSession;

interface CreateUserWithPasswordParams {
	db: Database;
	email: string;
	encryptionKey: Buffer;
	name: string;
	password: string;
}

function generateRandomString() {
	return randomBytes(32).toString("hex");
}

function generateTwoFactorKey(): string {
	const bytes = randomBytes(5);
	const value = encodeBase32UpperCaseNoPadding(bytes);
	return value;
}

function generateTwoFactorRecoveryCode(): string {
	const bytes = randomBytes(10);
	const value = encodeBase32UpperCaseNoPadding(bytes);
	return value;
}

function encrypt(data: Buffer, encryptionKey: Buffer): Buffer {
	const iv = randomBytes(16);
	const cipher = createCipheriv("aes-128-gcm", encryptionKey, iv);
	return Buffer.concat([iv, cipher.update(data), cipher.final(), cipher.getAuthTag()]);
}

function encryptUtf8String(data: string, encryptionKey: Buffer): Buffer {
	return encrypt(Buffer.from(data, "utf-8"), encryptionKey);
}

async function generatePasswordHash(password: string): Promise<string> {
	return hash(password, {
		memoryCost: 19_456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1,
	});
}

export async function createUserWithPassword(params: CreateUserWithPasswordParams): Promise<User> {
	const { db, email, encryptionKey, name, password } = params;

	const passwordHash = await generatePasswordHash(password);
	const twoFactorRecoveryCode = encryptUtf8String(generateTwoFactorRecoveryCode(), encryptionKey);

	const [user] = await db
		.insert(schema.users)
		.values({
			email,
			passwordHash,
			name,
			twoFactorRecoveryCode,
		})
		.returning({
			id: schema.users.id,
			email: schema.users.email,
			name: schema.users.name,
			role: schema.users.role,
			canManageAdmins: schema.users.canManageAdmins,
			isEmailVerified: schema.users.isEmailVerified,
			personDocumentId: schema.users.personDocumentId,
			organisationalUnitDocumentId: schema.users.organisationalUnitDocumentId,
			isTwoFactorRegistered: sql<boolean>`${schema.users.twoFactorTotpKey} IS NOT NULL`,
		});

	if (user == null) {
		throw new DatabaseError({ message: "Failed to create user" });
	}

	return user;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createAuthService(params: CreateAuthServiceParams) {
	const { config, context, secrets } = params;

	const { cookies, db, email } = context;

	function hashSessionSecret(secret: string): Buffer {
		return createHash("sha-256").update(secret).digest();
	}

	function decrypt(encrypted: Buffer): Buffer {
		assert.ok(encrypted.byteLength >= 32);

		const iv = encrypted.subarray(0, 16);
		const authTag = encrypted.subarray(-16);
		const ciphertext = encrypted.subarray(16, -16);
		const decipher = createDecipheriv("aes-128-gcm", secrets.encryptionKey, iv);
		decipher.setAuthTag(authTag);
		return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	}

	function encryptBuffer(data: Buffer): Buffer {
		return encrypt(data, secrets.encryptionKey);
	}

	function encryptString(data: string): Buffer {
		return encryptUtf8String(data, secrets.encryptionKey);
	}

	function decryptToString(data: Buffer): string {
		return decrypt(data).toString("utf-8");
	}

	async function createSession(
		userId: string,
		isTwoFactorVerified = false,
	): Promise<Session & { token: string }> {
		const now = Date.now();

		const id = generateRandomString();
		const secret = generateRandomString();
		const secretHash = hashSessionSecret(secret);
		const token = `${id}.${secret}`;

		const [session] = await db
			.insert(schema.sessions)
			.values({
				id,
				secretHash,
				expiresAt: new Date(now + config.sessions.cookie.durationMs),
				userId,
				isTwoFactorVerified,
			})
			.returning({
				id: schema.sessions.id,
				secretHash: schema.sessions.secretHash,
				expiresAt: schema.sessions.expiresAt,
				isTwoFactorVerified: schema.sessions.isTwoFactorVerified,
			});

		if (session == null) {
			throw new DatabaseError({});
		}

		return {
			id: session.id,
			secretHash: session.secretHash,
			expiresAt: session.expiresAt,
			isTwoFactorVerified: session.isTwoFactorVerified,
			token,
		};
	}

	async function validateSessionToken(token: string): Promise<SessionValidationResult> {
		const segments = token.split(".");
		const [id, secret] = segments;

		if (segments.length !== 2 || id == null || secret == null) {
			return { session: null, user: null };
		}

		const result = await getSession(id);

		if (result.session == null) {
			return { session: null, user: null };
		}

		const secretHash = hashSessionSecret(secret);

		const isValidSession = timingSafeEqual(secretHash, result.session.secretHash);

		if (!isValidSession) {
			await deleteSessionCookie();

			return { session: null, user: null };
		}

		return result;
	}

	async function getSession(id: string): Promise<SessionValidationResult> {
		const now = Date.now();

		const [result] = await db
			.select({
				user: {
					id: schema.users.id,
					email: schema.users.email,
					name: schema.users.name,
					role: schema.users.role,
					canManageAdmins: schema.users.canManageAdmins,
					isEmailVerified: schema.users.isEmailVerified,
					personDocumentId: schema.users.personDocumentId,
					organisationalUnitDocumentId: schema.users.organisationalUnitDocumentId,
					isTwoFactorRegistered: sql<boolean>`${schema.users.twoFactorTotpKey} IS NOT NULL`,
				},
				session: {
					id: schema.sessions.id,
					secretHash: schema.sessions.secretHash,
					expiresAt: schema.sessions.expiresAt,
					isTwoFactorVerified: schema.sessions.isTwoFactorVerified,
				},
			})
			.from(schema.sessions)
			.innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
			.where(eq(schema.sessions.id, id));

		if (result == null) {
			return { session: null, user: null };
		}

		if (now >= result.session.expiresAt.getTime()) {
			await deleteSession(result.session.id);

			return { session: null, user: null };
		}

		// TODO: inactivity timeout
		if (now >= result.session.expiresAt.getTime() - config.sessions.cookie.durationMs / 2) {
			result.session.expiresAt = new Date(now + config.sessions.cookie.durationMs);

			await db
				.update(schema.sessions)
				.set({ expiresAt: result.session.expiresAt })
				.where(eq(schema.sessions.id, result.session.id));
		}

		return result;
	}

	async function deleteSession(id: string): Promise<void> {
		await db.delete(schema.sessions).where(eq(schema.sessions.id, id));
	}

	async function deleteUserSessions(userId: string): Promise<void> {
		await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
	}

	async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
		await cookies.set(config.sessions.cookie.name, token, {
			...config.sessions.cookie.options,
			expires: expiresAt,
		});
	}

	async function deleteSessionCookie(): Promise<void> {
		await cookies.delete(config.sessions.cookie.name);
	}

	async function getSessionCookie(): Promise<string | null> {
		return await cookies.get(config.sessions.cookie.name);
	}

	async function getCurrentSession(): Promise<SessionValidationResult> {
		const token = await getSessionCookie();

		if (token == null) {
			return { session: null, user: null };
		}

		const session = await validateSessionToken(token);

		return session;
	}

	async function setSessionTwoFactorVerified(id: string) {
		await db
			.update(schema.sessions)
			.set({ isTwoFactorVerified: true })
			.where(eq(schema.sessions.id, id));
	}

	async function getUserByEmail(email: string): Promise<User | null> {
		const [user] = await db
			.select({
				id: schema.users.id,
				email: schema.users.email,
				name: schema.users.name,
				role: schema.users.role,
				canManageAdmins: schema.users.canManageAdmins,
				isEmailVerified: schema.users.isEmailVerified,
				personDocumentId: schema.users.personDocumentId,
				organisationalUnitDocumentId: schema.users.organisationalUnitDocumentId,
				isTwoFactorRegistered: sql<boolean>`${schema.users.twoFactorTotpKey} IS NOT NULL`,
			})
			.from(schema.users)
			.where(eq(schema.users.email, email));

		if (user == null) {
			return null;
		}

		return user;
	}

	async function getUserPasswordHash(userId: string): Promise<string> {
		const [user] = await db
			.select({
				passwordHash: schema.users.passwordHash,
			})
			.from(schema.users)
			.where(eq(schema.users.id, userId));

		if (user?.passwordHash == null) {
			throw new InvalidUserIdError({ id: userId, message: "Invalid user" });
		}

		return user.passwordHash;
	}

	async function verifyPasswordHash(passwordHash: string, password: string): Promise<boolean> {
		return verify(passwordHash, password);
	}

	async function verifyPasswordStrength(password: string): Promise<boolean> {
		if (
			password.length < config.passwords.length.min ||
			password.length > config.passwords.length.max
		) {
			return false;
		}

		const hash = createHash("sha1").update(password).digest("hex");
		const prefix = hash.slice(0, 5);

		const url = createUrl({
			baseUrl: "https://api.pwnedpasswords.com",
			pathname: `/range/${prefix}`,
		});

		const { data } = (await request(url, { responseType: "text" })).unwrap();
		const items = data.split("\n");

		for (const item of items) {
			const suffix = item.slice(0, 35).toLowerCase();

			if (hash === prefix + suffix) {
				return false;
			}
		}

		return true;
	}

	async function isEmailAvailable(email: string): Promise<boolean> {
		const count = await db.$count(
			schema.users,
			eq(sql`LOWER(${schema.users.email})`, email.toLowerCase()),
		);

		return count === 0;
	}

	async function createUser(email: string, name: string, password: string): Promise<User> {
		return createUserWithPassword({
			db,
			email,
			encryptionKey: secrets.encryptionKey,
			name,
			password,
		});
	}

	async function deleteEmailVerificationRequest(userId: string): Promise<void> {
		await db
			.delete(schema.emailVerificationRequests)
			.where(eq(schema.emailVerificationRequests.userId, userId));
	}

	async function createEmailVerificationRequest(
		userId: string,
		email: string,
	): Promise<EmailVerificationRequest & { token: string }> {
		await deleteEmailVerificationRequest(userId);

		const id = generateRandomString();
		const code = generateTwoFactorKey();
		const expiresAt = new Date(Date.now() + config.emailVerificationRequests.cookie.durationMs);

		const [request] = await db
			.insert(schema.emailVerificationRequests)
			.values({
				id,
				userId,
				code,
				email,
				expiresAt,
			})
			.returning({
				id: schema.emailVerificationRequests.id,
				userId: schema.emailVerificationRequests.userId,
				code: schema.emailVerificationRequests.code,
				email: schema.emailVerificationRequests.email,
				expiresAt: schema.emailVerificationRequests.expiresAt,
			});

		if (request == null) {
			throw new DatabaseError({ message: "Could not create email verification request" });
		}

		return { ...request, token: id };
	}

	async function sendVerificationEmail(to: string, code: string): Promise<void> {
		await email.sendEmail({
			from: config.emailAddress,
			to,
			subject: "Verification code",
			text: `Your verification code is ${code}`,
		});
	}

	async function setEmailVerificationRequestCookie(token: string, expiresAt: Date): Promise<void> {
		await cookies.set(config.emailVerificationRequests.cookie.name, token, {
			...config.emailVerificationRequests.cookie.options,
			expires: expiresAt,
		});
	}

	async function getEmailVerificationRequestFromRequest(): Promise<
		(EmailVerificationRequest & { token: string }) | null
	> {
		const { user } = await getCurrentSession();

		if (user == null) {
			return null;
		}

		const token = await getEmailVerificationRequestToken();

		if (token == null) {
			return null;
		}

		const request = await getEmailVerificationRequest(user.id, token);

		if (request == null) {
			await deleteEmailVerificationRequestCookie();

			return null;
		}

		return { ...request, token: request.id };
	}

	async function getEmailVerificationRequestToken(): Promise<string | null> {
		return await cookies.get(config.emailVerificationRequests.cookie.name);
	}

	async function deleteEmailVerificationRequestCookie(): Promise<void> {
		await cookies.delete(config.emailVerificationRequests.cookie.name);
	}

	async function getEmailVerificationRequest(
		userId: string,
		token: string,
	): Promise<EmailVerificationRequest | null> {
		const id = token;

		const [request] = await db
			.select({
				id: schema.emailVerificationRequests.id,
				userId: schema.emailVerificationRequests.userId,
				code: schema.emailVerificationRequests.code,
				email: schema.emailVerificationRequests.email,
				expiresAt: schema.emailVerificationRequests.expiresAt,
			})
			.from(schema.emailVerificationRequests)
			.where(
				and(
					eq(schema.emailVerificationRequests.id, id),
					eq(schema.emailVerificationRequests.userId, userId),
				),
			);

		if (request == null) {
			return null;
		}

		return request;
	}

	async function deletePasswordResetSessions(userId: string): Promise<void> {
		await db
			.delete(schema.passwordResetSessions)
			.where(eq(schema.passwordResetSessions.userId, userId));
	}

	async function updateEmailAndSetEmailAsVerified(userId: string, email: string): Promise<void> {
		await db
			.update(schema.users)
			.set({
				email,
				isEmailVerified: true,
			})
			.where(eq(schema.users.id, userId));
	}

	async function getRecoveryCode(userId: string): Promise<string | null> {
		const [user] = await db
			.select({
				twoFactorRecoveryCode: schema.users.twoFactorRecoveryCode,
			})
			.from(schema.users)
			.where(eq(schema.users.id, userId));

		if (user == null) {
			return null;
		}

		return decryptToString(user.twoFactorRecoveryCode);
	}

	async function updatePassword(userId: string, password: string): Promise<void> {
		const passwordHash = await generatePasswordHash(password);

		await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, userId));
	}

	async function resetRecoveryCode(userId: string): Promise<string> {
		const unencryptedRecoveryCode = generateTwoFactorRecoveryCode();
		const twoFactorRecoveryCode = encryptString(unencryptedRecoveryCode);

		await db.update(schema.users).set({ twoFactorRecoveryCode }).where(eq(schema.users.id, userId));

		return unencryptedRecoveryCode;
	}

	async function deleteUserPasswordResetSessions(userId: string): Promise<void> {
		await db
			.delete(schema.passwordResetSessions)
			.where(eq(schema.passwordResetSessions.userId, userId));
	}

	async function createPasswordResetSession(
		userId: string,
		email: string,
	): Promise<PasswordResetSession & { token: string }> {
		await deleteUserPasswordResetSessions(userId);

		const id = generateRandomString();
		const sessionId = hashSessionSecret(id).toString("hex");
		const code = generateTwoFactorKey();

		const [session] = await db
			.insert(schema.passwordResetSessions)
			.values({
				id: sessionId,
				userId,
				email,
				code,
				expiresAt: new Date(Date.now() + config.passwordResetSessions.cookie.durationMs),
			})
			.returning({
				id: schema.passwordResetSessions.id,
				userId: schema.passwordResetSessions.userId,
				email: schema.passwordResetSessions.email,
				code: schema.passwordResetSessions.code,
				expiresAt: schema.passwordResetSessions.expiresAt,
				isEmailVerified: schema.passwordResetSessions.isEmailVerified,
				isTwoFactorVerified: schema.passwordResetSessions.isTwoFactorVerified,
			});

		if (session == null) {
			throw new DatabaseError({ message: "Failed to create password reset session" });
		}

		return { ...session, token: id };
	}

	async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
		await email.sendEmail({
			from: config.emailAddress,
			to,
			subject: "Reset code",
			text: `Your reset code is ${code}`,
		});
	}

	async function setPasswordResetSessionCookie(token: string, expiresAt: Date): Promise<void> {
		await cookies.set(config.passwordResetSessions.cookie.name, token, {
			...config.passwordResetSessions.cookie.options,
			expires: expiresAt,
		});
	}

	async function deletePasswordResetSessionCookie(): Promise<void> {
		await cookies.delete(config.passwordResetSessions.cookie.name);
	}

	async function getPasswordResetSessionCookie(): Promise<string | null> {
		return await cookies.get(config.passwordResetSessions.cookie.name);
	}

	async function validatePasswordResetSessionFromRequest(): Promise<PasswordResetSessionValidationResult> {
		const token = await getPasswordResetSessionCookie();

		if (token == null) {
			return { session: null, user: null };
		}

		const result = await getPasswordResetSession(token);

		if (result.session == null) {
			await deletePasswordResetSessionCookie();

			return { session: null, user: null };
		}

		return result;
	}

	async function getPasswordResetSession(
		token: string,
	): Promise<PasswordResetSessionValidationResult> {
		const id = hashSessionSecret(token).toString("hex");

		const [session] = await db
			.select({
				session: {
					id: schema.passwordResetSessions.id,
					userId: schema.passwordResetSessions.userId,
					email: schema.passwordResetSessions.email,
					code: schema.passwordResetSessions.code,
					expiresAt: schema.passwordResetSessions.expiresAt,
					isEmailVerified: schema.passwordResetSessions.isEmailVerified,
					isTwoFactorVerified: schema.passwordResetSessions.isTwoFactorVerified,
				},
				user: {
					id: schema.users.id,
					email: schema.users.email,
					name: schema.users.name,
					role: schema.users.role,
					canManageAdmins: schema.users.canManageAdmins,
					isEmailVerified: schema.users.isEmailVerified,
					personDocumentId: schema.users.personDocumentId,
					organisationalUnitDocumentId: schema.users.organisationalUnitDocumentId,
					isTwoFactorRegistered: sql<boolean>`${schema.users.twoFactorTotpKey} IS NOT NULL`,
				},
			})
			.from(schema.passwordResetSessions)
			.innerJoin(schema.users, eq(schema.passwordResetSessions.userId, schema.users.id))
			.where(eq(schema.passwordResetSessions.id, id));

		if (session == null) {
			return { session: null, user: null };
		}

		return session;
	}

	async function getUserTotpKey(userId: string): Promise<Buffer | null> {
		const [user] = await db
			.select({
				twoFactorTotpKey: schema.users.twoFactorTotpKey,
			})
			.from(schema.users)
			.where(eq(schema.users.id, userId));

		if (user?.twoFactorTotpKey == null) {
			return null;
		}

		return decrypt(user.twoFactorTotpKey);
	}

	async function setPasswordResetSessionAsTwoFactorVerified(id: string): Promise<void> {
		await db
			.update(schema.passwordResetSessions)
			.set({ isTwoFactorVerified: true })
			.where(eq(schema.passwordResetSessions.id, id));
	}

	async function resetUserTwoFactorWithRecoveryCode(
		userId: string,
		code: string,
	): Promise<boolean> {
		return await db.transaction(async (tx) => {
			const [user] = await tx
				.select({
					twoFactorRecoveryCode: schema.users.twoFactorRecoveryCode,
				})
				.from(schema.users)
				.where(eq(schema.users.id, userId));

			if (user == null) {
				return false;
			}

			const currentRecoveryCode = decryptToString(user.twoFactorRecoveryCode);

			if (code !== currentRecoveryCode) {
				return false;
			}

			const newRecoveryCode = encryptString(generateTwoFactorRecoveryCode());

			await tx
				.update(schema.sessions)
				.set({
					isTwoFactorVerified: false,
				})
				.where(eq(schema.sessions.userId, userId));

			const [result] = await tx
				.update(schema.users)
				.set({
					twoFactorRecoveryCode: newRecoveryCode,
					twoFactorTotpKey: null,
				})
				.where(
					and(
						eq(schema.users.id, userId),
						eq(schema.users.twoFactorRecoveryCode, user.twoFactorRecoveryCode),
					),
				)
				.returning({ id: schema.users.id });

			return result != null;
		});
	}

	async function setPasswordResetSessionAsEmailVerified(id: string): Promise<void> {
		await db
			.update(schema.passwordResetSessions)
			.set({
				isEmailVerified: true,
			})
			.where(eq(schema.passwordResetSessions.id, id));
	}

	async function setUserAsEmailVerifiedIfEmailMatches(
		userId: string,
		email: string,
	): Promise<boolean> {
		const [user] = await db
			.update(schema.users)
			.set({
				isEmailVerified: true,
			})
			.where(and(eq(schema.users.id, userId), eq(schema.users.email, email)))
			.returning({ id: schema.users.id });

		return user != null;
	}

	async function setSessionAsTwoFactorVerified(id: string): Promise<void> {
		await db
			.update(schema.sessions)
			.set({
				isTwoFactorVerified: true,
			})
			.where(eq(schema.sessions.id, id));
	}

	async function updateUserTotpKey(userId: string, key: Buffer): Promise<void> {
		const twoFactorTotpKey = encryptBuffer(key);

		await db
			.update(schema.users)
			.set({
				twoFactorTotpKey,
			})
			.where(eq(schema.users.id, userId));
	}

	function verifyTotp(key: Buffer, code: string): boolean {
		return verifyTOTP(key, 30, 6, code);
	}

	function createTotpKeyUri(issuer: string, userName: string): { key: string; uri: string } {
		const k = randomBytes(20);
		const key = encodeBase64(k);
		const uri = createTOTPKeyURI(issuer, userName, k, 30, 6);

		return { key, uri };
	}

	const passwordResetEmailIpBucket = new RefillingTokenBucket<string>(3, 60);
	const passwordResetEmailUserBucket = new RefillingTokenBucket<string>(3, 60);
	const signUpIpBucket = new RefillingTokenBucket<string>(3, 10);
	const totpUpdateBucket = new RefillingTokenBucket<string>(3, 60 * 10);
	const signInTrottler = new Throttler<string>([1, 2, 4, 8, 16, 30, 60, 180, 300]);
	const signInIpBucket = new RefillingTokenBucket<string>(20, 1);
	const totpBucket = new ExpiringTokenBucket<string>(5, 60 * 30);
	const recoveryCodeBucket = new ExpiringTokenBucket<string>(3, 60 * 60);
	const emailVerificationBucket = new ExpiringTokenBucket<string>(5, 60 * 30);
	const passwordUpdateBucket = new ExpiringTokenBucket<string>(5, 60 * 30);
	const sendVerificationEmailBucket = new ExpiringTokenBucket<string>(3, 60 * 10);
	const verifyEmailBucket = new ExpiringTokenBucket<string>(5, 60 * 30);

	const service = {
		createSession,
		getSession,
		validateSessionToken,
		deleteSession,
		deleteUserSessions,
		setSessionTwoFactorVerified,
		setSessionCookie,
		deleteSessionCookie,
		getSessionCookie,
		getCurrentSession,
		getUserByEmail,
		getUserPasswordHash,
		updatePassword,
		verifyPasswordHash,
		verifyPasswordStrength,
		isEmailAvailable,
		createUser,
		createEmailVerificationRequest,
		deleteEmailVerificationRequest,
		sendVerificationEmail,
		setEmailVerificationRequestCookie,
		getEmailVerificationRequestFromRequest,
		deleteEmailVerificationRequestCookie,
		getEmailVerificationRequestToken,
		deletePasswordResetSessions,
		updateEmailAndSetEmailAsVerified,
		getRecoveryCode,
		resetRecoveryCode,
		deleteUserPasswordResetSessions,
		createPasswordResetSession,
		sendPasswordResetEmail,
		setPasswordResetSessionCookie,
		deletePasswordResetSessionCookie,
		validatePasswordResetSessionFromRequest,
		getUserTotpKey,
		verifyTotp,
		createTotpKeyUri,
		setPasswordResetSessionAsTwoFactorVerified,
		resetUserTwoFactorWithRecoveryCode,
		setPasswordResetSessionAsEmailVerified,
		setUserAsEmailVerifiedIfEmailMatches,
		setSessionAsTwoFactorVerified,
		updateUserTotpKey,
		decodeBase64,

		passwordResetEmailIpBucket,
		passwordResetEmailUserBucket,
		signUpIpBucket,
		totpUpdateBucket,
		signInTrottler,
		signInIpBucket,
		totpBucket,
		recoveryCodeBucket,
		emailVerificationBucket,
		passwordUpdateBucket,
		sendVerificationEmailBucket,
		verifyEmailBucket,
	};

	return service;
}

export type AuthService = ReturnType<typeof createAuthService>;
