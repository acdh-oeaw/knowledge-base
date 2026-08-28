import { createUrl, isNonEmptyString } from "@acdh-oeaw/lib";
import type {
	DariahCampusCurriculum,
	DariahCampusResource,
	DariahCampusResourceCollection,
} from "@dariah-eric/client-campus";
import type { ResourceDocument } from "@dariah-eric/search";

import { toPlainText } from "./markdown/to-plain-text";

/** Public Dariah-Campus website, used to link back to the resource on the ingest source website. */
const campusWebBaseUrl = "https://campus.dariah.eu";

/** Maps a resource collection to its `:resourceType` path segment in the public campus url. */
const resourceTypeByCollection: Record<DariahCampusResourceCollection, string> = {
	resourcesEvents: "events",
	resourcesExternal: "external",
	resourcesHosted: "hosted",
	resourcesPathfinders: "pathfinders",
};

export function createCampusResource(item: DariahCampusResource): ResourceDocument {
	const source = "dariah-campus" as const;
	const sourceId = item.id;
	const id = [source, sourceId].join(":");
	const authors = [...item.authors, ...item.editors].map((person) => person.name);
	const keywords = item.tags.map((tag) => tag.name);
	const year = isNonEmptyString(item["publication-date"])
		? new Date(item["publication-date"]).getFullYear()
		: null;
	/**
	 * Dariah-Campus hosts the resource itself, so the campus website is always the ingest source
	 * website, regardless of resource kind.
	 */
	const source_url = String(
		createUrl({
			baseUrl: campusWebBaseUrl,
			pathname: `/resources/${resourceTypeByCollection[item.collection]}/${item.id}`,
		}),
	);
	/**
	 * The persistent identifier (a handle url) always points to the resource, and external resources
	 * additionally link to where they are actually hosted.
	 */
	const links: Array<string> = [];
	if (isNonEmptyString(item.pid)) {
		links.push(item.pid);
	}
	if (isNonEmptyString(item.external?.url)) {
		links.push(item.external.url);
	}
	const sourceUpdatedAt = isNonEmptyString(item["publication-date"])
		? new Date(item["publication-date"]).getTime()
		: null;

	return {
		id,
		source,
		source_id: sourceId,
		source_updated_at: sourceUpdatedAt,
		imported_at: Date.now(),
		type: "training-material",
		label: item.title,
		description: toPlainText(item.summary.content),
		source_url,
		links,
		keywords,
		kind: null,
		national_consortia: [],
		working_groups: [],
		institutions: [],
		upstream_sources: [],
		authors,
		year,
		pid: item.pid,
	};
}

export function createCampusCurriculum(item: DariahCampusCurriculum): ResourceDocument {
	const source = "dariah-campus" as const;
	const sourceId = item.id;
	const id = [source, sourceId].join(":");
	const authors = item.editors.map((person) => person.name);
	const keywords = item.tags.map((tag) => tag.name);
	const year = isNonEmptyString(item["publication-date"])
		? new Date(item["publication-date"]).getFullYear()
		: null;
	/**
	 * Dariah-Campus hosts the curriculum itself, so the campus website is always the ingest source
	 * website.
	 */
	const source_url = String(
		createUrl({ baseUrl: campusWebBaseUrl, pathname: `/curricula/${item.id}` }),
	);
	/** The persistent identifier (a handle url) always points to the curriculum. */
	const links: Array<string> = [];
	if (isNonEmptyString(item.pid)) {
		links.push(item.pid);
	}
	const sourceUpdatedAt = isNonEmptyString(item["publication-date"])
		? new Date(item["publication-date"]).getTime()
		: null;

	return {
		id,
		source,
		source_id: sourceId,
		source_updated_at: sourceUpdatedAt,
		imported_at: Date.now(),
		type: "training-material",
		label: item.title,
		description: toPlainText(item.summary.content),
		source_url,
		links,
		keywords,
		kind: null,
		national_consortia: [],
		working_groups: [],
		institutions: [],
		upstream_sources: [],
		authors,
		year,
		pid: item.pid,
	};
}
