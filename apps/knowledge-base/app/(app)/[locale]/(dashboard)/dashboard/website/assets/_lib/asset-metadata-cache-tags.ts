import type { CacheTag } from "@dariah-eric/cache-tags";

export function getAssetMetadataCacheTags(affectsSiteMetadata: boolean): Array<CacheTag> {
	return ["assets", ...(affectsSiteMetadata ? (["site-metadata"] as const) : [])];
}
