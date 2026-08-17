import { isNonEmptyString, log } from "@acdh-oeaw/lib";
import type { ZoteroJsonItem } from "@dariah-eric/client-zotero";
import type { ResourceDocument } from "@dariah-eric/search";

export interface ZoteroJsonItemData {
	title?: string;
	abstractNote?: string;
	creators?: Array<{
		firstName?: string;
		lastName?: string;
		creatorType?: string;
	}>;
	date?: string;
	tags?: Array<{ tag: string }>;
	url?: string;
	DOI?: string;
	itemType?: string;
	dateModified?: string;
	collections?: Array<string>;
	[key: string]: unknown;
}

export interface ZoteroOrgUnitLookups {
	/** Lowercased country code → set of currently-active national-consortium slugs for that country. */
	countrySlugToNc: Map<string, Set<string>>;
	/** Slugs of currently published working groups. */
	wgSlugs: Set<string>;
}

export interface ZoteroCollectionLookup {
	/** Zotero collection key → collection name. */
	namesByKey: Map<string, string>;
}

export function isZoteroItemInCollection(item: ZoteroJsonItem<ZoteroJsonItemData>): boolean {
	return item.data.collections != null && item.data.collections.length > 0;
}

export function createZoteroItem(
	item: ZoteroJsonItem<ZoteroJsonItemData>,
	collections: ZoteroCollectionLookup,
	orgUnits: ZoteroOrgUnitLookups,
): ResourceDocument {
	const data = item.data;
	const authors = [];

	for (const creator of data.creators ?? []) {
		const name = [creator.firstName, creator.lastName]
			.filter((name) => isNonEmptyString(name))
			.join(" ");

		if (isNonEmptyString(name)) {
			authors.push(name);
		}
	}

	const yearRaw = data.date != null ? /\d{4}/.exec(data.date)?.[0] : null;
	const year = yearRaw != null ? Number(yearRaw) : null;
	const source = "zotero";
	const sourceId = item.key;
	const id = [source, sourceId].join(":");
	const sourceUpdatedAt = data.dateModified != null ? new Date(data.dateModified).getTime() : null;

	const nationalConsortia = new Set<string>();
	const workingGroups = new Set<string>();
	for (const collectionKey of data.collections ?? []) {
		const name = collections.namesByKey.get(collectionKey);
		if (name == null) {
			log.warn(`Zotero item ${item.key} references unknown collection key ${collectionKey}.`);
			continue;
		}
		const slug = name.trim().toLowerCase();
		const ncSlugs = orgUnits.countrySlugToNc.get(slug);
		if (ncSlugs != null) {
			for (const slug of ncSlugs) {
				nationalConsortia.add(slug);
			}
			continue;
		}
		if (orgUnits.wgSlugs.has(slug)) {
			workingGroups.add(slug);
			continue;
		}
		log.warn(
			`Zotero collection "${name}" (key ${collectionKey}) does not match any country or working group.`,
		);
	}

	return {
		id,
		source,
		source_id: sourceId,
		source_updated_at: sourceUpdatedAt,
		imported_at: Date.now(),
		type: "publication",
		label: data.title ?? "",
		description: data.abstractNote ?? "",
		links: data.url != null ? [data.url] : [],
		keywords: data.tags?.map((tag) => tag.tag).filter((keyword) => isNonEmptyString(keyword)) ?? [],
		kind: data.itemType ?? null,
		national_consortia: [...nationalConsortia],
		working_groups: [...workingGroups],
		institutions: [],
		upstream_sources: null,
		authors,
		year,
		pid: data.DOI ?? null,
	};
}
