import { defineConfig } from "drizzle-kit";

import { env } from "./env.config";

const config = defineConfig({
	out: "./unr-schema",
	dbCredentials: {
		url: env.UNR_DATABASE_DIRECT_URL,
	},
	dialect: "postgresql",
});

export default config;
