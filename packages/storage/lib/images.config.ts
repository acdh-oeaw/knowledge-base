export const assetPrefixes = ["avatars", "documents", "images", "logos"] as const;

export type AssetPrefix = (typeof assetPrefixes)[number];
