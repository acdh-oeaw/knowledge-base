/* eslint-disable no-restricted-syntax */

import { define } from "@acdh-knowledge-base/env";
import * as v from "valibot";

const validate = define({
	envVars: v.object({
		API_ACCESS_TOKEN: v.optional(v.pipe(v.string(), v.nonEmpty())),
		API_ALLOWED_ORIGINS: v.optional(
			v.pipe(
				v.string(),
				v.nonEmpty(),
				v.transform((value) => value.split(",")),
				v.array(v.pipe(v.string(), v.trim(), v.url())),
			),
		),
		API_BASE_URL: v.pipe(v.string(), v.url()),
		API_LOG_LEVEL: v.optional(
			v.picklist(["silent", "fatal", "error", "warn", "info", "debug", "trace"]),
			"info",
		),
		API_PORT: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1))),
		CI: v.optional(v.pipe(v.unknown(), v.toBoolean())),
		DATABASE_HOST: v.pipe(v.string(), v.nonEmpty()),
		DATABASE_NAME: v.pipe(v.string(), v.nonEmpty()),
		DATABASE_PASSWORD: v.pipe(v.string(), v.minLength(8)),
		DATABASE_PORT: v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
		DATABASE_SSL_CONNECTION: v.optional(v.picklist(["disabled", "enabled"]), "disabled"),
		DATABASE_USER: v.pipe(v.string(), v.nonEmpty()),
		IMGPROXY_BASE_URL: v.pipe(v.string(), v.url()),
		IMGPROXY_KEY: v.pipe(v.string(), v.nonEmpty()),
		IMGPROXY_SALT: v.pipe(v.string(), v.nonEmpty()),
		S3_ACCESS_KEY: v.pipe(v.string(), v.nonEmpty()),
		S3_BUCKET_NAME: v.pipe(v.string(), v.nonEmpty()),
		S3_HOST: v.pipe(v.string(), v.nonEmpty()),
		S3_PORT: v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
		S3_PROTOCOL: v.optional(v.picklist(["http", "https"]), "https"),
		S3_SECRET_KEY: v.pipe(v.string(), v.nonEmpty()),
		TYPESENSE_HOST: v.pipe(v.string(), v.nonEmpty()),
		TYPESENSE_PORT: v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
		TYPESENSE_PROTOCOL: v.optional(v.picklist(["http", "https"]), "https"),
		TYPESENSE_RESOURCE_COLLECTION_NAME: v.pipe(v.string(), v.nonEmpty()),
		TYPESENSE_WEBSITE_COLLECTION_NAME: v.pipe(v.string(), v.nonEmpty()),
		TYPESENSE_SEARCH_API_KEY: v.pipe(v.string(), v.nonEmpty()),
	}),
});

export const env = validate({
	environment: {
		API_ACCESS_TOKEN: process.env.API_ACCESS_TOKEN,
		API_ALLOWED_ORIGINS: process.env.API_ALLOWED_ORIGINS,
		API_BASE_URL: process.env.API_BASE_URL,
		API_LOG_LEVEL: process.env.API_LOG_LEVEL,
		API_PORT: process.env.API_PORT,
		CI: process.env.CI,
		DATABASE_HOST: process.env.DATABASE_HOST,
		DATABASE_NAME: process.env.DATABASE_NAME,
		DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
		DATABASE_PORT: process.env.DATABASE_PORT,
		DATABASE_SSL_CONNECTION: process.env.DATABASE_SSL_CONNECTION,
		DATABASE_USER: process.env.DATABASE_USER,
		IMGPROXY_BASE_URL: process.env.IMGPROXY_BASE_URL,
		IMGPROXY_KEY: process.env.IMGPROXY_KEY,
		IMGPROXY_SALT: process.env.IMGPROXY_SALT,
		S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
		S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
		S3_HOST: process.env.S3_HOST,
		S3_PORT: process.env.S3_PORT,
		S3_PROTOCOL: process.env.S3_PROTOCOL,
		S3_SECRET_KEY: process.env.S3_SECRET_KEY,
		TYPESENSE_HOST: process.env.TYPESENSE_HOST,
		TYPESENSE_PORT: process.env.TYPESENSE_PORT,
		TYPESENSE_PROTOCOL: process.env.TYPESENSE_PROTOCOL,
		TYPESENSE_RESOURCE_COLLECTION_NAME: process.env.TYPESENSE_RESOURCE_COLLECTION_NAME,
		TYPESENSE_WEBSITE_COLLECTION_NAME: process.env.TYPESENSE_WEBSITE_COLLECTION_NAME,
		TYPESENSE_SEARCH_API_KEY: process.env.TYPESENSE_SEARCH_API_KEY,
	},
}).unwrap();
