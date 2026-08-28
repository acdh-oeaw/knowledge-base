import type { SyncWebsiteSearchIndexResult } from "@dariah-eric/search-website";

import { syncWebsiteSearchIndex as syncWebsiteSearchDocuments } from "@/lib/search/website-index";

/**
 * Re-exported rather than re-declared, so the admin task cannot drift from what the service
 * returns.
 */
export type { SyncWebsiteSearchIndexResult };

export async function syncWebsiteSearchIndex(): Promise<SyncWebsiteSearchIndexResult> {
	return syncWebsiteSearchDocuments();
}
