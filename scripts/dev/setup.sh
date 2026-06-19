#!/bin/sh

set -eu

pnpm storage:buckets:create
echo "✓ Created storage buckets."

pnpm run db:setup
echo "✓ Applied database migrations and seeded CMS data."

pnpm search:collections:create
echo "✓ Created search collections."

TYPESENSE_SEARCH_API_KEY=$(pnpm --silent search:api-keys:generate --raw)
echo "✓ Generated search api key."

sh ./scripts/dev/search-api-key.sh "$TYPESENSE_SEARCH_API_KEY"
echo "✓ Updated environment variables."
