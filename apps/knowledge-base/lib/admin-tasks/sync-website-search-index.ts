import { syncWebsiteSearchIndex as syncWebsiteSearchDocuments } from "@/lib/search/website-index";

export interface SyncWebsiteSearchIndexResult {
	count: number;
	failedCount: number;
}

export async function syncWebsiteSearchIndex(): Promise<SyncWebsiteSearchIndexResult> {
	return syncWebsiteSearchDocuments();
}
