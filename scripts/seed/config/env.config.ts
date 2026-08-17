/* eslint-disable no-restricted-syntax */

import { define } from "@dariah-eric/env";
import * as v from "valibot";

const validate = define({
	envVars: v.object({
		ADMIN_EMAIL: v.optional(v.pipe(v.string(), v.trim(), v.nonEmpty(), v.email())),
		ADMIN_NAME: v.optional(v.pipe(v.string(), v.trim(), v.nonEmpty())),
		ADMIN_PASSWORD: v.optional(v.pipe(v.string(), v.trim(), v.nonEmpty())),
		AUTH_ENCRYPTION_KEY: v.pipe(v.string(), v.length(32)),
		DATABASE_HOST: v.pipe(v.string(), v.nonEmpty()),
		DATABASE_NAME: v.pipe(v.string(), v.nonEmpty()),
		DATABASE_PASSWORD: v.pipe(v.string(), v.minLength(8)),
		DATABASE_PORT: v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
		DATABASE_SSL_CONNECTION: v.optional(v.picklist(["disabled", "enabled"]), "disabled"),
		DATABASE_USER: v.pipe(v.string(), v.nonEmpty()),
		S3_ACCESS_KEY: v.pipe(v.string(), v.nonEmpty()),
		S3_BUCKET_NAME: v.pipe(v.string(), v.nonEmpty()),
		S3_HOST: v.pipe(v.string(), v.nonEmpty()),
		S3_PORT: v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
		S3_PROTOCOL: v.optional(v.picklist(["http", "https"]), "https"),
		S3_SECRET_KEY: v.pipe(v.string(), v.nonEmpty()),
		TYPESENSE_ADMIN_API_KEY: v.pipe(v.string(), v.nonEmpty()),
		TYPESENSE_HOST: v.pipe(v.string(), v.nonEmpty()),
		TYPESENSE_PORT: v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
		TYPESENSE_PROTOCOL: v.optional(v.picklist(["http", "https"]), "https"),
		TYPESENSE_RESOURCE_COLLECTION_NAME: v.pipe(v.string(), v.nonEmpty()),
		TYPESENSE_WEBSITE_COLLECTION_NAME: v.pipe(v.string(), v.nonEmpty()),
	}),
});

export const env = validate({
	environment: {
		ADMIN_EMAIL: process.env.ADMIN_EMAIL,
		ADMIN_NAME: process.env.ADMIN_NAME,
		ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
		AUTH_ENCRYPTION_KEY: process.env.AUTH_ENCRYPTION_KEY,
		DATABASE_HOST: process.env.DATABASE_HOST,
		DATABASE_NAME: process.env.DATABASE_NAME,
		DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
		DATABASE_PORT: process.env.DATABASE_PORT,
		DATABASE_SSL_CONNECTION: process.env.DATABASE_SSL_CONNECTION,
		DATABASE_USER: process.env.DATABASE_USER,
		S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
		S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
		S3_HOST: process.env.S3_HOST,
		S3_PORT: process.env.S3_PORT,
		S3_PROTOCOL: process.env.S3_PROTOCOL,
		S3_SECRET_KEY: process.env.S3_SECRET_KEY,
		TYPESENSE_ADMIN_API_KEY: process.env.TYPESENSE_ADMIN_API_KEY,
		TYPESENSE_HOST: process.env.TYPESENSE_HOST,
		TYPESENSE_PORT: process.env.TYPESENSE_PORT,
		TYPESENSE_PROTOCOL: process.env.TYPESENSE_PROTOCOL,
		TYPESENSE_RESOURCE_COLLECTION_NAME: process.env.TYPESENSE_RESOURCE_COLLECTION_NAME,
		TYPESENSE_WEBSITE_COLLECTION_NAME: process.env.TYPESENSE_WEBSITE_COLLECTION_NAME,
	},
}).unwrap();
