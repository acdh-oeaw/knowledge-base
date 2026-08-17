import { createSearchService } from "@dariah-eric/search";
import {
	type SupportedWebsiteEntityType,
	type SyncWebsiteDocumentResult,
	type WebsiteDocumentDescriptor,
	createWebsiteSearchIndexService,
	supportedWebsiteEntityTypes,
} from "@dariah-eric/search-website";

import { env } from "@/config/env.config";
import { db } from "@/lib/db";
import { search } from "@/lib/search/admin";

const searchService = createSearchService({
	apiKey: env.TYPESENSE_ADMIN_API_KEY,
	collections: {
		resources: env.NEXT_PUBLIC_TYPESENSE_RESOURCE_COLLECTION_NAME,
		website: env.NEXT_PUBLIC_TYPESENSE_WEBSITE_COLLECTION_NAME,
	},
	nodes: [
		{
			host: env.NEXT_PUBLIC_TYPESENSE_HOST,
			port: env.NEXT_PUBLIC_TYPESENSE_PORT,
			protocol: env.NEXT_PUBLIC_TYPESENSE_PROTOCOL,
		},
	],
});

const websiteSearchIndex = createWebsiteSearchIndexService({ db, search, searchService });

export { supportedWebsiteEntityTypes };
export type {
	SupportedWebsiteEntityType as SupportedEntityType,
	SyncWebsiteDocumentResult,
	WebsiteDocumentDescriptor,
};

export const deleteWebsiteDocument = websiteSearchIndex.deleteWebsiteDocument;
export const createWebsiteEntityDocuments = websiteSearchIndex.createWebsiteEntityDocuments;
export const getSyncableWebsiteEntityIds = websiteSearchIndex.getSyncableWebsiteEntityIds;
export const getSyncableWebsiteEntityIdsByType =
	websiteSearchIndex.getSyncableWebsiteEntityIdsByType;
export const getWebsiteDocumentDescriptorByEntityId =
	websiteSearchIndex.getWebsiteDocumentDescriptorByEntityId;
export const getWebsiteDocumentForEntity = websiteSearchIndex.getWebsiteDocumentForEntity;
export const syncWebsiteDocumentForEntity = websiteSearchIndex.syncWebsiteDocumentForEntity;
export const syncWebsiteDocumentForEntityWithResult =
	websiteSearchIndex.syncWebsiteDocumentForEntityWithResult;
export const syncWebsiteSearchIndex = websiteSearchIndex.syncWebsiteSearchIndex;
