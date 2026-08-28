import { define } from "@dariah-eric/env";
import * as v from "valibot";

const validate = define({
	envVars: v.object({
		DATABASE_HOST: v.pipe(v.string(), v.nonEmpty()),
		DATABASE_NAME: v.pipe(v.string(), v.nonEmpty()),
		DATABASE_PASSWORD: v.pipe(v.string(), v.minLength(8)),
		DATABASE_PORT: v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
		DATABASE_USER: v.pipe(v.string(), v.nonEmpty()),
		S3_ACCESS_KEY: v.pipe(v.string(), v.nonEmpty()),
		S3_BUCKET_NAME: v.pipe(v.string(), v.nonEmpty()),
		S3_HOST: v.pipe(v.string(), v.nonEmpty()),
		S3_PORT: v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
		S3_PROTOCOL: v.optional(v.picklist(["http", "https"]), "https"),
		S3_SECRET_KEY: v.pipe(v.string(), v.nonEmpty()),
	}),
});

export const env = validate({
	environment: {
		DATABASE_HOST: process.env.DATABASE_HOST,
		DATABASE_NAME: process.env.DATABASE_NAME,
		DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
		DATABASE_PORT: process.env.DATABASE_PORT,
		DATABASE_USER: process.env.DATABASE_USER,
		S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
		S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
		S3_HOST: process.env.S3_HOST,
		S3_PORT: process.env.S3_PORT,
		S3_PROTOCOL: process.env.S3_PROTOCOL,
		S3_SECRET_KEY: process.env.S3_SECRET_KEY,
	},
}).unwrap();
