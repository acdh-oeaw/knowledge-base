import type { SearchItem } from "@acdh-knowledge-base/client-sshoc";
import type { ZoteroCollection, ZoteroJsonItem } from "@acdh-knowledge-base/client-zotero";
import type { ResourceDocument, WebsiteDocument } from "@acdh-knowledge-base/search";

import { createSshocItem } from "./sshoc";
import {
	type ZoteroCollectionLookup,
	type ZoteroJsonItemData,
	createZoteroItem,
	isZoteroItemInCollection,
} from "./zotero";

export interface SearchIndexResourceSourceData {
	sshocItems: Array<SearchItem>;
	zoteroItems: Array<ZoteroJsonItem<ZoteroJsonItemData>>;
	zoteroCollections: Array<ZoteroCollection>;
}

export interface OrgUnitResourceLookups {
	sshocActorIdToNc: Map<number, Set<string>>;
	sshocActorIdToWg: Map<number, Set<string>>;
	sshocActorIdToInstitution: Map<number, Set<string>>;
	countrySlugToNc: Map<string, Set<string>>;
	wgSlugs: Set<string>;
}

export interface CreateSearchIndexResourceDocumentsParams {
	sourceData: SearchIndexResourceSourceData;
	sshocMarketplaceBaseUrl: string;
	orgUnits: OrgUnitResourceLookups;
}

function buildZoteroCollectionLookup(
	zoteroCollections: Array<ZoteroCollection>,
): ZoteroCollectionLookup {
	const namesByKey = new Map<string, string>();
	for (const collection of zoteroCollections) {
		namesByKey.set(collection.key, collection.data.name);
	}
	return { namesByKey };
}

export function createSearchIndexResourceDocuments(
	params: CreateSearchIndexResourceDocumentsParams,
): Array<ResourceDocument> {
	const { sourceData, sshocMarketplaceBaseUrl, orgUnits } = params;
	const {
		sshocItems,
		zoteroItems,
		zoteroCollections,
	} = sourceData;

	const zoteroCollectionLookup = buildZoteroCollectionLookup(zoteroCollections);

	return [
		...sshocItems.map((item) => createSshocItem(item, sshocMarketplaceBaseUrl, orgUnits)),
		...zoteroItems
			.filter((item) => isZoteroItemInCollection(item))
			.map((item) => createZoteroItem(item, zoteroCollectionLookup, orgUnits)),
	];
}

export function createWebsiteResourceDocument(resource: ResourceDocument): WebsiteDocument {
	return {
		id: resource.id,
		kind: "resource",
		source: resource.source,
		source_id: resource.source_id,
		source_updated_at: resource.source_updated_at,
		imported_at: resource.imported_at,
		type: resource.type,
		label: resource.label,
		description: resource.description,
		link: resource.links[0],
	};
}

export function createWebsiteResourceDocuments(
	resources: Array<ResourceDocument>,
): Array<WebsiteDocument> {
	return resources.map((resource) => createWebsiteResourceDocument(resource));
}
