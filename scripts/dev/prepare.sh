#!/bin/sh

set -eu

API_ACCESS_TOKEN=$(openssl rand --hex 32)
AUTH_ENCRYPTION_KEY=$(openssl rand --hex 16)
AUTH_SIGN_UP="enabled"
DATABASE_PASSWORD=$(openssl rand --hex 32)
IMGPROXY_KEY=$(openssl rand --hex 32)
IMGPROXY_SALT=$(openssl rand --hex 16)
NEXT_PUBLIC_APP_IMPRINT_CUSTOM_CONFIG="disabled"
REVALIDATION_WEBHOOK_SECRET=$(openssl rand --hex 32)
S3_ACCESS_KEY=$(openssl rand --hex 16)
S3_SECRET_KEY=$(openssl rand --hex 32)
SEARCH_SYNC_API_SECRET=$(openssl rand --hex 32)
TYPESENSE_ADMIN_API_KEY=$(openssl rand --hex 32)

set_env_value() {
	KEY=$1
	VALUE=$2
	FILE=$3

	sed -i -E "s|^${KEY}=.*$|${KEY}=\"${VALUE}\"|" "$FILE"
}

ENV_FILE=./.devcontainer/.env

if [ ! -f "$ENV_FILE" ]; then
	cp $ENV_FILE.example $ENV_FILE

	set_env_value API_ACCESS_TOKEN "$API_ACCESS_TOKEN" "$ENV_FILE"
	set_env_value AUTH_ENCRYPTION_KEY "$AUTH_ENCRYPTION_KEY" "$ENV_FILE"
	set_env_value DATABASE_PASSWORD "$DATABASE_PASSWORD" "$ENV_FILE"
	set_env_value IMGPROXY_KEY "$IMGPROXY_KEY" "$ENV_FILE"
	set_env_value IMGPROXY_SALT "$IMGPROXY_SALT" "$ENV_FILE"
	set_env_value REVALIDATION_WEBHOOK_SECRET "$REVALIDATION_WEBHOOK_SECRET" "$ENV_FILE"
	set_env_value S3_ACCESS_KEY "$S3_ACCESS_KEY" "$ENV_FILE"
	set_env_value S3_SECRET_KEY "$S3_SECRET_KEY" "$ENV_FILE"
	set_env_value SEARCH_SYNC_API_SECRET "$SEARCH_SYNC_API_SECRET" "$ENV_FILE"
	set_env_value TYPESENSE_ADMIN_API_KEY "$TYPESENSE_ADMIN_API_KEY" "$ENV_FILE"
fi

ENV_FILE=./apps/knowledge-base/.env.local

if [ ! -f "$ENV_FILE" ]; then
	cp $ENV_FILE.example $ENV_FILE

	set_env_value API_ACCESS_TOKEN "$API_ACCESS_TOKEN" "$ENV_FILE"
	set_env_value AUTH_ENCRYPTION_KEY "$AUTH_ENCRYPTION_KEY" "$ENV_FILE"
	set_env_value AUTH_SIGN_UP "$AUTH_SIGN_UP" "$ENV_FILE"
	set_env_value DATABASE_PASSWORD "$DATABASE_PASSWORD" "$ENV_FILE"
	set_env_value IMGPROXY_KEY "$IMGPROXY_KEY" "$ENV_FILE"
	set_env_value IMGPROXY_SALT "$IMGPROXY_SALT" "$ENV_FILE"
	set_env_value NEXT_PUBLIC_APP_IMPRINT_CUSTOM_CONFIG "$NEXT_PUBLIC_APP_IMPRINT_CUSTOM_CONFIG" "$ENV_FILE"
	set_env_value REVALIDATION_WEBHOOK_SECRET "$REVALIDATION_WEBHOOK_SECRET" "$ENV_FILE"
	set_env_value S3_ACCESS_KEY "$S3_ACCESS_KEY" "$ENV_FILE"
	set_env_value S3_SECRET_KEY "$S3_SECRET_KEY" "$ENV_FILE"
	set_env_value SEARCH_SYNC_API_SECRET "$SEARCH_SYNC_API_SECRET" "$ENV_FILE"
	set_env_value TYPESENSE_ADMIN_API_KEY "$TYPESENSE_ADMIN_API_KEY" "$ENV_FILE"
fi

ENV_FILE=./apps/website/.env.local

if [ ! -f "$ENV_FILE" ]; then
	cp $ENV_FILE.example $ENV_FILE

	set_env_value DATABASE_PASSWORD "$DATABASE_PASSWORD" "$ENV_FILE"
	set_env_value IMGPROXY_KEY "$IMGPROXY_KEY" "$ENV_FILE"
	set_env_value IMGPROXY_SALT "$IMGPROXY_SALT" "$ENV_FILE"
	set_env_value REVALIDATION_WEBHOOK_SECRET "$REVALIDATION_WEBHOOK_SECRET" "$ENV_FILE"
	set_env_value S3_ACCESS_KEY "$S3_ACCESS_KEY" "$ENV_FILE"
	set_env_value S3_SECRET_KEY "$S3_SECRET_KEY" "$ENV_FILE"
	set_env_value TYPESENSE_ADMIN_API_KEY "$TYPESENSE_ADMIN_API_KEY" "$ENV_FILE"
fi

ENV_FILE=./apps/api/.env.local

if [ ! -f "$ENV_FILE" ]; then
	cp $ENV_FILE.example $ENV_FILE

	set_env_value API_ACCESS_TOKEN "$API_ACCESS_TOKEN" "$ENV_FILE"
	set_env_value DATABASE_PASSWORD "$DATABASE_PASSWORD" "$ENV_FILE"
	set_env_value IMGPROXY_KEY "$IMGPROXY_KEY" "$ENV_FILE"
	set_env_value IMGPROXY_SALT "$IMGPROXY_SALT" "$ENV_FILE"
	set_env_value S3_ACCESS_KEY "$S3_ACCESS_KEY" "$ENV_FILE"
	set_env_value S3_SECRET_KEY "$S3_SECRET_KEY" "$ENV_FILE"
fi

echo "✓ Environment variables initialized."
