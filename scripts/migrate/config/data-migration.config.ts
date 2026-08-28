import * as path from "node:path";

export const apiBaseUrl = "https://clariah.at";
export const assetsGithubPath =
	"https://raw.githubusercontent.com/acdh-oeaw/clariah-at-website/refs/heads/main/public";
export const assetSizeLimit = 6 * 1024 * 1024;
export const assetsPath = "../../../../clariah-at-website/public";

export const cacheFolderPath = path.join(process.cwd(), ".cache");
export const cacheFilePath = path.join(cacheFolderPath, "wordpress.json");

export const assetsCacheFolderPath = path.join(cacheFolderPath, "assets");
export const assetsCacheFilePath = path.join(assetsCacheFolderPath, "wordpress-assets.json");

export const placeholderImageUrl = new URL(
	"https://www.dariah.eu/wp-content/uploads/2018/02/dariaheu_new_logo.png",
);
