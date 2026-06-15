import * as path from "node:path";

export const apiBaseUrl = "https://www.dariah.eu";

export const cacheFolderPath = path.join(process.cwd(), ".cache");
export const cacheFilePath = path.join(cacheFolderPath, "wordpress.json");

export const assetsCacheFolderPath = path.join(cacheFolderPath, "assets");
export const assetsCacheFilePath = path.join(assetsCacheFolderPath, "wordpress-assets.json");

export const placeholderImageUrl = new URL(
	"https://www.dariah.eu/wp-content/uploads/2018/02/dariaheu_new_logo.png",
);
