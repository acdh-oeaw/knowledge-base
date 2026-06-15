# syntax=docker/dockerfile:1

# base
# -------------------------------------------------------------------------------------------------

FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME/bin:$PNPM_HOME:$PATH"
ENV CI=true
# pnpm 11 may run dependency verification before package scripts, which can fail in
# turbo-pruned Docker workspaces.
# @see {@link https://github.com/pnpm/pnpm/issues/11865}
ENV pnpm_config_verify_deps_before_run=false
RUN corepack enable
# `turbo prune` runs before `pnpm install`, so it needs a turbo binary available up front. The version
# is supplied as a build arg (resolved from the lockfile in CI) instead of installing the floating
# latest, so prune is reproducible and matches the repo turbo used via `pnpm exec turbo` in the build
# stages.
ARG TURBO_VERSION
RUN pnpm add --global "turbo@${TURBO_VERSION}"

# source
# -------------------------------------------------------------------------------------------------

FROM base AS source
WORKDIR /app
COPY . .

# =================================================================================================
# migrate
# =================================================================================================

# prune
# -------------------------------------------------------------------------------------------------

FROM source AS migrate-prune
RUN turbo prune @acdh-knowledge-base/database --docker

# install
# -------------------------------------------------------------------------------------------------

FROM base AS migrate-install
WORKDIR /app
COPY --from=migrate-prune /app/out/json/ .
COPY --from=migrate-prune /app/patches/ ./patches/
COPY --from=migrate-prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# build
# -------------------------------------------------------------------------------------------------

FROM migrate-install AS migrate-build
COPY --from=migrate-prune /app/out/full/ .
RUN --mount=type=secret,id=TURBO_TEAM,env=TURBO_TEAM \
    --mount=type=secret,id=TURBO_TOKEN,env=TURBO_TOKEN \
    pnpm exec turbo run build --filter=@acdh-knowledge-base/database^...
# We don't set `injectWorkspacePackages` directly in `pnpm-workspace.yaml` because it currently
# produces lots of peer dependency warnings.
RUN pnpm deploy --filter @acdh-knowledge-base/database --config.inject-workspace-packages=true /out

# serve
# -------------------------------------------------------------------------------------------------

FROM base AS migrate
USER node
WORKDIR /app
COPY --chown=node:node --from=migrate-build /out/ .
CMD [ "pnpm", "run", "db:migrations:apply" ]

# =================================================================================================
# api
# =================================================================================================

# prune
# -------------------------------------------------------------------------------------------------

FROM source AS api-prune
RUN turbo prune @acdh-knowledge-base/api --docker

# install
# -------------------------------------------------------------------------------------------------

FROM base AS api-install
WORKDIR /app
COPY --from=api-prune /app/out/json/ .
COPY --from=api-prune /app/patches/ ./patches/
COPY --from=api-prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# build
# -------------------------------------------------------------------------------------------------

FROM api-install AS api-build
COPY --from=api-prune /app/out/full/ .
RUN --mount=type=secret,id=TURBO_TEAM,env=TURBO_TEAM \
    --mount=type=secret,id=TURBO_TOKEN,env=TURBO_TOKEN \
    pnpm exec turbo run build --filter=@acdh-knowledge-base/api
# We don't set `injectWorkspacePackages` directly in `pnpm-workspace.yaml` because it currently
# produces lots of peer dependency warnings.
RUN pnpm deploy --filter @acdh-knowledge-base/api --config.inject-workspace-packages=true --prod /out

# serve
# -------------------------------------------------------------------------------------------------

FROM base AS api
USER node
WORKDIR /app
COPY --chown=node:node --from=api-build /out/node_modules/ /app/node_modules/
COPY --chown=node:node --from=api-build /out/public/ /app/public/
COPY --chown=node:node --from=api-build /out/dist/ /app/dist/
ENV NODE_ENV=production
EXPOSE 3000
CMD [ "node", "./dist/index.mjs" ]

# =================================================================================================
# app
# =================================================================================================

# prune
# -------------------------------------------------------------------------------------------------

FROM source AS app-prune
RUN turbo prune @acdh-knowledge-base/knowledge-base --docker

# install
# -------------------------------------------------------------------------------------------------

FROM base AS app-install
WORKDIR /app
COPY --from=app-prune /app/out/json/ .
COPY --from=app-prune /app/patches/ ./patches/
COPY --from=app-prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# build
# -------------------------------------------------------------------------------------------------

FROM app-install AS app-build
ARG BUILD_MODE=standalone
ARG NEXT_PUBLIC_APP_BASE_URL
ARG NEXT_PUBLIC_APP_BOTS
ARG NEXT_PUBLIC_APP_GOOGLE_SITE_VERIFICATION
ARG NEXT_PUBLIC_APP_IMPRINT_CUSTOM_CONFIG
ARG NEXT_PUBLIC_APP_IMPRINT_SERVICE_BASE_URL
ARG NEXT_PUBLIC_APP_MATOMO_BASE_URL
ARG NEXT_PUBLIC_APP_MATOMO_ID
ARG NEXT_PUBLIC_APP_SENTRY_DSN
ARG NEXT_PUBLIC_APP_SENTRY_ORG
ARG NEXT_PUBLIC_APP_SENTRY_PII
ARG NEXT_PUBLIC_APP_SENTRY_PROJECT
ARG NEXT_PUBLIC_APP_SERVICE_ID
ARG NEXT_PUBLIC_TYPESENSE_RESOURCE_COLLECTION_NAME
ARG NEXT_PUBLIC_TYPESENSE_WEBSITE_COLLECTION_NAME
ARG NEXT_PUBLIC_TYPESENSE_HOST
ARG NEXT_PUBLIC_TYPESENSE_PORT
ARG NEXT_PUBLIC_TYPESENSE_PROTOCOL
ARG NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY
COPY --from=app-prune /app/out/full/ .
RUN --mount=type=secret,id=API_ACCESS_TOKEN,env=API_ACCESS_TOKEN \
    --mount=type=secret,id=AUTH_ENCRYPTION_KEY,env=AUTH_ENCRYPTION_KEY \
    --mount=type=secret,id=AUTH_SIGN_UP,env=AUTH_SIGN_UP \
    --mount=type=secret,id=CORDIS_API_KEY,env=CORDIS_API_KEY \
    --mount=type=secret,id=CORDIS_API_BASE_URL,env=CORDIS_API_BASE_URL \
    --mount=type=secret,id=DATABASE_HOST,env=DATABASE_HOST \
    --mount=type=secret,id=DATABASE_NAME,env=DATABASE_NAME \
    --mount=type=secret,id=DATABASE_PASSWORD,env=DATABASE_PASSWORD \
    --mount=type=secret,id=DATABASE_PORT,env=DATABASE_PORT \
    --mount=type=secret,id=DATABASE_USER,env=DATABASE_USER \
    --mount=type=secret,id=EMAIL_ADDRESS,env=EMAIL_ADDRESS \
    --mount=type=secret,id=EMAIL_SMTP_PORT,env=EMAIL_SMTP_PORT \
    --mount=type=secret,id=EMAIL_SMTP_SERVER,env=EMAIL_SMTP_SERVER \
    --mount=type=secret,id=IMGPROXY_BASE_URL,env=IMGPROXY_BASE_URL \
    --mount=type=secret,id=IMGPROXY_KEY,env=IMGPROXY_KEY \
    --mount=type=secret,id=IMGPROXY_PORT,env=IMGPROXY_PORT \
    --mount=type=secret,id=IMGPROXY_SALT,env=IMGPROXY_SALT \
    --mount=type=secret,id=MAILCHIMP_API_BASE_URL,env=MAILCHIMP_API_BASE_URL \
    --mount=type=secret,id=MAILCHIMP_API_KEY,env=MAILCHIMP_API_KEY \
    --mount=type=secret,id=MAILCHIMP_LIST_ID,env=MAILCHIMP_LIST_ID \
    --mount=type=secret,id=OPENAIRE_API_BASE_URL,env=OPENAIRE_API_BASE_URL \
    --mount=type=secret,id=REVALIDATION_WEBHOOK_SECRET,env=REVALIDATION_WEBHOOK_SECRET \
    --mount=type=secret,id=REVALIDATION_WEBHOOK_URL,env=REVALIDATION_WEBHOOK_URL \
    --mount=type=secret,id=S3_ACCESS_KEY,env=S3_ACCESS_KEY \
    --mount=type=secret,id=S3_BUCKET_NAME,env=S3_BUCKET_NAME \
    --mount=type=secret,id=S3_HOST,env=S3_HOST \
    --mount=type=secret,id=S3_PORT,env=S3_PORT \
    --mount=type=secret,id=S3_PROTOCOL,env=S3_PROTOCOL \
    --mount=type=secret,id=S3_SECRET_KEY,env=S3_SECRET_KEY \
    --mount=type=secret,id=SEARCH_SYNC_API_SECRET,env=SEARCH_SYNC_API_SECRET \
    --mount=type=secret,id=SSHOC_MARKETPLACE_API_BASE_URL,env=SSHOC_MARKETPLACE_API_BASE_URL \
    --mount=type=secret,id=SSHOC_MARKETPLACE_BASE_URL,env=SSHOC_MARKETPLACE_BASE_URL \
    --mount=type=secret,id=SSHOC_MARKETPLACE_PASSWORD,env=SSHOC_MARKETPLACE_PASSWORD \
    --mount=type=secret,id=SSHOC_MARKETPLACE_USER,env=SSHOC_MARKETPLACE_USER \
    --mount=type=secret,id=TYPESENSE_ADMIN_API_KEY,env=TYPESENSE_ADMIN_API_KEY \
    --mount=type=secret,id=TURBO_TEAM,env=TURBO_TEAM \
    --mount=type=secret,id=TURBO_TOKEN,env=TURBO_TOKEN \
		--mount=type=secret,id=UNR_DATABASE_DIRECT_URL,env=UNR_DATABASE_DIRECT_URL \
		--mount=type=secret,id=UNR_S3_BUCKET_NAME,env=UNR_S3_BUCKET_NAME \
    --mount=type=secret,id=ZOTERO_API_KEY,env=ZOTERO_API_KEY \
    --mount=type=secret,id=ZOTERO_API_BASE_URL,env=ZOTERO_API_BASE_URL \
    pnpm exec turbo run build --filter=@acdh-knowledge-base/knowledge-base

# serve
# -------------------------------------------------------------------------------------------------

FROM base AS app
USER node
WORKDIR /app
# `.next/standalone` is self-contained (includes its own `node_modules`)
COPY --chown=node:node --from=app-build /app/apps/knowledge-base/.next/standalone/ /app/
COPY --chown=node:node --from=app-build /app/apps/knowledge-base/.next/static/ /app/apps/knowledge-base/.next/static/
COPY --chown=node:node --from=app-build /app/apps/knowledge-base/public/ /app/apps/knowledge-base/public/
ENV NODE_ENV=production
EXPOSE 3000
CMD [ "node", "./apps/knowledge-base/server.js" ]
