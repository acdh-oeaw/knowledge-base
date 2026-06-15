import { inArray, sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { lower, uuidv7 } from "../functions";
import { entities } from "./entities";

export const userRoleEnum = ["admin", "user"] as const;

export const users = p.snakeCase.table(
	"users",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		email: p.text("email").notNull(),
		isEmailVerified: p.boolean("is_email_verified").notNull().default(false),
		passwordHash: p.text("password_hash").notNull(),
		twoFactorTotpKey: p.bytea("two_factor_totp_key"),
		twoFactorRecoveryCode: p.bytea("two_factor_recovery_code").notNull(),
		name: p.text("name").notNull(),
		role: p.text("role", { enum: userRoleEnum }).notNull().default("user"),
		canManageAdmins: p.boolean("can_manage_admins").notNull().default(false),
		// A user's actor (person or country) is document-level: these reference `entities.id` (document
		// ids), not version ids, so the link stays valid across the actor's draft/publish lifecycle.
		personDocumentId: p.uuid("person_document_id").references(() => entities.id),
		organisationalUnitDocumentId: p
			.uuid("organisational_unit_document_id")
			.references(() => entities.id),
		...f.timestamps(),
	},
	(t) => [
		p.uniqueIndex("users_email_unique").on(lower(t.email)),
		p.check("users_role_enum_check", inArray(t.role, userRoleEnum)),
		p.check(
			"users_can_manage_admins_requires_admin_role_check",
			sql`
					NOT (
						${t.canManageAdmins}
						AND ${t.role} <> 'admin'
					)
				`,
		),
		p.check(
			"users_actor_xor_check",
			sql`
					NOT (
						${t.personDocumentId} IS NOT NULL
						AND ${t.organisationalUnitDocumentId} IS NOT NULL
					)
				`,
		),
	],
);

export type User = typeof users.$inferSelect;
export type UserInput = typeof users.$inferInsert;

export const UserSelectSchema = createSelectSchema(users);
export const UserInsertSchema = createInsertSchema(users);
export const UserUpdateSchema = createUpdateSchema(users);

export const sessions = p.snakeCase.table("sessions", {
	id: p.text("id").primaryKey(),
	secretHash: p.bytea("secret_hash").notNull(),
	userId: p
		.uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	expiresAt: f.timestamp("expires_at").notNull(),
	isTwoFactorVerified: p.boolean("is_two_factor_verified").notNull().default(false),
	...f.timestamps(),
});

export type Session = typeof sessions.$inferSelect;
export type SessionInput = typeof sessions.$inferInsert;

export const SessionSelectSchema = createSelectSchema(sessions);
export const SessionInsertSchema = createInsertSchema(sessions);
export const SessionUpdateSchema = createUpdateSchema(sessions);

export const passwordResetSessions = p.snakeCase.table("password_reset_sessions", {
	id: p.text("id").primaryKey(),
	userId: p
		.uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	email: p.text("email").notNull(),
	isEmailVerified: p.boolean("is_email_verified").notNull().default(false),
	code: p.text("code").notNull(),
	expiresAt: f.timestamp("expires_at").notNull(),
	isTwoFactorVerified: p.boolean("is_two_factor_verified").notNull().default(false),
	...f.timestamps(),
});

export type PasswordResetSession = typeof passwordResetSessions.$inferSelect;
export type PasswordResetSessionInput = typeof passwordResetSessions.$inferInsert;

export const PasswordResetSessionSelectSchema = createSelectSchema(passwordResetSessions);
export const PasswordResetSessionInsertSchema = createInsertSchema(passwordResetSessions);
export const PasswordResetSessionUpdateSchema = createUpdateSchema(passwordResetSessions);

export const emailVerificationRequests = p.snakeCase.table("email_verification_requests", {
	id: p.text("id").primaryKey(),
	userId: p
		.uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	email: p.text("email").notNull(),
	code: p.text("code").notNull(),
	expiresAt: f.timestamp("expires_at").notNull(),
	...f.timestamps(),
});

export type EmailVerificationRequest = typeof emailVerificationRequests.$inferSelect;
export type EmailVerificationRequestInput = typeof emailVerificationRequests.$inferInsert;

export const EmailVerificationRequestSelectSchema = createSelectSchema(emailVerificationRequests);
export const EmailVerificationRequestInsertSchema = createInsertSchema(emailVerificationRequests);
export const EmailVerificationRequestUpdateSchema = createUpdateSchema(emailVerificationRequests);
