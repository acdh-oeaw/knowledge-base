import type { JSONContent } from "@tiptap/core";

/** What `uploadImageAction` reports back about the asset it just created. */
export interface UploadedAsset {
	id: string;
	key: string;
	url: string;
	alt: string | null;
	caption: JSONContent | null;
	licenseId: string | null;
	mimeType: string;
}

export interface MediaLibraryAsset {
	key: string;
	label: string;
	mimeType?: string;
	url: string;
	// Richer metadata, provided by `getMediaLibraryAssets` / `GET /api/assets`.
	// Optional so callers that forward a minimal `{ key, label, url }` shape stay
	// assignable; the fields are populated at runtime for the media library list view.
	id?: string;
	alt?: string | null;
	caption?: JSONContent | null;
	licenseId?: string | null;
	size?: number | null;
	/** Null for vectors, and for assets whose dimensions have not been measured yet. */
	width?: number | null;
	height?: number | null;
	/**
	 * Resolved from {@link MediaLibraryAsset.licenseId} when the media library hands an asset to a
	 * caller, so consumers can label the license without loading the license list themselves.
	 */
	license?: { code: string; name: string } | null;
}
