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

export const passwords = {
	length: {
		min: 8,
		max: 255,
	},
};

export const emailVerificationRequests: { cookie: CookieConfig } = {
	cookie: {
		name: "email_verification",
		options: {
			httpOnly: true,
			sameSite: "lax" as const,
			// oxlint-disable-next-line node/no-process-env
			secure: process.env.NODE_ENV === "production",
			path: "/",
		},
		durationMs: 1000 * 60 * 10 /** 10 mins. */,
	},
};

export const passwordResetSessions: { cookie: CookieConfig } = {
	cookie: {
		name: "password_reset_session",
		options: {
			httpOnly: true,
			sameSite: "lax" as const,
			// oxlint-disable-next-line node/no-process-env
			secure: process.env.NODE_ENV === "production",
			path: "/",
		},
		durationMs: 1000 * 60 * 10 /** 10 mins. */,
	},
};

export const sessions: {
	cookie: CookieConfig;
	impersonation: { durationMs: number };
} = {
	cookie: {
		name: "session",
		options: {
			httpOnly: true,
			sameSite: "lax" as const,
			// oxlint-disable-next-line node/no-process-env
			secure: process.env.NODE_ENV === "production",
			path: "/",
		},
		durationMs: 1000 * 60 * 60 * 24 * 30 /** 30 days. */,
	},
	impersonation: {
		/**
		 * Long enough to cover a full working session helping a coordinator through country metadata or
		 * a yearly report, rather than bouncing an admin out mid-form and making them re-enter.
		 *
		 * It is not the thing that stops an admin forgetting they are impersonating -- the banner on
		 * every dashboard page does that, and returning to your own account is one click. This bound
		 * only guarantees an impersonation cannot outlive the working day it started in, on top of the
		 * per-request re-authorisation in `getSession` (which ends it the moment either account's role
		 * changes).
		 */
		durationMs: 1000 * 60 * 60 * 6 /** 6 hours. */,
	},
};

/** Two-factor app name. */
export const issuer = "The Knowledge Base";
