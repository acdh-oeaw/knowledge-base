import { define } from "@dariah-eric/env";
import * as v from "valibot";

const validate = define({
	envVars: v.object({
		DATABASE_HOST: v.pipe(v.string(), v.nonEmpty()),
		DATABASE_NAME: v.pipe(v.string(), v.nonEmpty()),
		DATABASE_PASSWORD: v.pipe(v.string(), v.nonEmpty()),
		DATABASE_PORT: v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
		DATABASE_SSL_CONNECTION: v.optional(v.picklist(["disabled", "enabled"]), "disabled"),
		DATABASE_USER: v.pipe(v.string(), v.nonEmpty()),
	}),
});

export const env = validate({
	environment: {
		DATABASE_HOST: process.env.DATABASE_HOST,
		DATABASE_NAME: process.env.DATABASE_NAME,
		DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
		DATABASE_PORT: process.env.DATABASE_PORT,
		DATABASE_SSL_CONNECTION: process.env.DATABASE_SSL_CONNECTION,
		DATABASE_USER: process.env.DATABASE_USER,
	},
}).unwrap();
