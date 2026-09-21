import type { DariahCampusCurriculum, DariahCampusResource } from "@dariah-eric/client-campus";
import type { SearchItem } from "@dariah-eric/client-sshoc";
import type { ZenodoRecord } from "@dariah-eric/client-zenodo";
import type { ResourceDocument, WebsiteDocument } from "@dariah-eric/search";

import { createCampusCurriculum, createCampusResource } from "./campus";
import { createSshocItem } from "./sshoc";
import { createZenodoRecord } from "./zenodo";

export interface SearchIndexResourceSourceData {
	campusCurricula: Array<DariahCampusCurriculum>;
	campusResources: Array<DariahCampusResource>;
	sshocItems: Array<SearchItem>;
	zenodoRecords: Array<ZenodoRecord>;
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

// NOTE: temporarily disabled together with the zotero source (see note above).
// function buildZoteroCollectionLookup(
// 	zoteroCollections: Array<ZoteroCollection>,
// ): ZoteroCollectionLookup {
// 	const namesByKey = new Map<string, string>();
// 	for (const collection of zoteroCollections) {
// 		namesByKey.set(collection.key, collection.data.name);
// 	}
// 	return { namesByKey };
// }

export function createSearchIndexResourceDocuments(
	params: CreateSearchIndexResourceDocumentsParams,
): Array<ResourceDocument> {
	const { sourceData, sshocMarketplaceBaseUrl, orgUnits } = params;
	const { campusCurricula, campusResources, sshocItems, zenodoRecords } = sourceData;

	return [
		...sshocItems.map((item) => createSshocItem(item, sshocMarketplaceBaseUrl, orgUnits)),
		...campusResources.map((item) => createCampusResource(item)),
		...campusCurricula.map((item) => createCampusCurriculum(item)),
		...zenodoRecords.map((item) => createZenodoRecord(item)),
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
		link: resource.links[0] ?? resource.source_url,
	};
}

export function createWebsiteResourceDocuments(
	resources: Array<ResourceDocument>,
): Array<WebsiteDocument> {
	return resources.map((resource) => createWebsiteResourceDocument(resource));
}
