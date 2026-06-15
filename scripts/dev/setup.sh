#!/bin/sh

set -eu

pnpm storage:buckets:create
echo "✓ Created storage buckets."

pnpm db:push && pnpm run db:migrations:apply
echo "✓ Applied database migrations."

pnpm search:collections:create
echo "✓ Created search collections."

TYPESENSE_SEARCH_API_KEY=$(pnpm --silent search:api-keys:generate --raw)
echo "✓ Generated search api key."

sh ./scripts/dev/search-api-key.sh "$TYPESENSE_SEARCH_API_KEY"
echo "✓ Updated environment variables."
