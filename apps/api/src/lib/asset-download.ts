import { imageVariantVersion } from "~/config/api.config";
import { env } from "~/config/env.config";

export {
	type DownloadableAsset,
	getContentDisposition,
	getContentDispositionHeader,
	getDownloadFilename,
} from "@dariah-eric/storage/download";

/**
 * Absolute download url for an asset, by storage key.
 *
 * By key rather than by asset id, because that is what rich-text link targets store: the asset
 * cleanup service finds richtext-embedded assets by scanning `jsonb` for the key, so keeping the
 * key as the reference is what makes an asset linked from prose count as used.
 *
 * The naming and disposition rules this pairs with live in `@dariah-eric/storage/download`, shared
 * with the dashboard; only the url is app-specific, since it needs this API's own base url.
 */
export function getAssetDownloadUrl(key: string): string {
	return new URL(`/api/v1/assets/${toKeyPath(key)}/download`, env.API_BASE_URL).href;
}

/**
 * Absolute base url of the image-variant endpoint for an asset, by storage key.
 *
 * Emitted rather than the bare key so that the route shape and the signing version stay this api's
 * concern: a consumer appends `?w=`/`&ar=` and never has to know how the path is spelled, and a key
 * rotation that bumps {@link imageVariantVersion} propagates on its own.
 */
export function getAssetImageUrl(key: string): string {
	return new URL(`/api/v1/assets/${toKeyPath(key)}/image/${imageVariantVersion}`, env.API_BASE_URL)
		.href;
}

function toKeyPath(key: string): string {
	return key
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}
