import { createAuthService } from "@dariah-eric/auth";
import { cookies } from "next/headers";

import {
	emailVerificationRequests,
	passwordResetSessions,
	passwords,
	sessions,
} from "@/config/auth.config";
import { env } from "@/config/env.config";
import { db } from "@/lib/db";
import { email } from "@/lib/email";

export const auth = createAuthService({
	config: {
		emailAddress: env.EMAIL_ADDRESS,
		passwords,
		emailVerificationRequests,
		passwordResetSessions,
		sessions,
	},
	context: {
		cookies: {
			async get(name: string) {
				const store = await cookies();
				const value = store.get(name)?.value ?? null;
				return value;
			},
			async set(
				name: string,
				value: string,
				cookie: {
					expires: Date;
					httpOnly: true;
					path: string;
					sameSite: "lax" | "strict";
					secure: boolean;
				},
			) {
				const store = await cookies();
				store.set(name, value, cookie);
			},
			async delete(name: string) {
				const store = await cookies();
				store.delete(name);
			},
		},
		db,
		email,
	},
	secrets: {
		encryptionKey: Buffer.from(env.AUTH_ENCRYPTION_KEY, "hex"),
	},
});
