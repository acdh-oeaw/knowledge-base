import type { CacheTag } from "@dariah-eric/cache-tags";
import { type DescribeRouteOptions, describeRoute as describeOpenApiRoute } from "hono-openapi";
import type { MiddlewareHandler } from "hono/types";

/** OpenAPI extension key under which every operation lists the cache tags it reads. */
export const cacheTagsExtension = "x-cache-tags";

export type DescribeCachedRouteOptions = DescribeRouteOptions & {
	/**
	 * The `@dariah-eric/cache-tags` slices this operation's response is computed from. When the
	 * knowledge-base dispatches a revalidation webhook for any of them, this operation's cached
	 * responses are stale. Declare `[]` for operations whose data is not managed by the dashboard
	 * (e.g. newsletters), so that "nothing to invalidate" is stated, not forgotten.
	 */
	[cacheTagsExtension]: ReadonlyArray<CacheTag>;
};

/**
 * `hono-openapi`'s `describeRoute`, with the `x-cache-tags` extension required. `hono-openapi`
 * copies the spec into the operation object verbatim, so the extension lands in the generated
 * document; this wrapper exists because `DescribeRouteOptions` does not type extension keys.
 */
export function describeRoute(spec: DescribeCachedRouteOptions): MiddlewareHandler {
	return describeOpenApiRoute(spec);
}
