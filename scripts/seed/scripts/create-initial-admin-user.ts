import { assert, log } from "@acdh-oeaw/lib";
import { createUserWithPassword } from "@dariah-eric/auth";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq } from "@dariah-eric/database/sql";

import { env } from "../config/env.config";

const db = createDatabaseService({
	connection: {
		database: env.DATABASE_NAME,
		host: env.DATABASE_HOST,
		password: env.DATABASE_PASSWORD,
		port: env.DATABASE_PORT,
		ssl: env.DATABASE_SSL_CONNECTION === "enabled",
		user: env.DATABASE_USER,
	},
	logger: env.NODE_ENV === "development",
}).unwrap();

async function main(): Promise<void> {
	try {
		const existingAdminManagerCount = await db.$count(
			schema.users,
			and(eq(schema.users.role, "admin"), eq(schema.users.canManageAdmins, true)),
		);

		if (existingAdminManagerCount > 0) {
			log.info("An admin user with admin-management privileges already exists. No changes made.");
			return;
		}

		const email = env.ADMIN_EMAIL;
		const name = env.ADMIN_NAME;
		const password = env.ADMIN_PASSWORD;

		assert(email, "Missing ADMIN_EMAIL environment variable.");
		assert(name, "Missing ADMIN_NAME environment variable.");
		assert(password, "Missing ADMIN_PASSWORD environment variable.");

		const existingUser = await db.query.users.findFirst({
			where: { email },
			columns: { id: true },
		});

		if (existingUser == null) {
			const user = await createUserWithPassword({
				db,
				email,
				encryptionKey: Buffer.from(env.AUTH_ENCRYPTION_KEY, "hex"),
				name,
				password,
			});

			await db
				.update(schema.users)
				.set({
					role: "admin",
					canManageAdmins: true,
					isEmailVerified: true,
				})
				.where(eq(schema.users.id, user.id));

			log.success(`Created initial admin user "${email}".`);
			return;
		}

		await db
			.update(schema.users)
			.set({
				name,
				role: "admin",
				canManageAdmins: true,
				isEmailVerified: true,
			})
			.where(eq(schema.users.id, existingUser.id));

		log.success(`Promoted existing user "${email}" to admin with admin-management privileges.`);
	} finally {
		await db.$client.end();
	}
}

main().catch((error: unknown) => {
	log.error("Failed to create admin user.\n", error);
	process.exitCode = 1;
});
