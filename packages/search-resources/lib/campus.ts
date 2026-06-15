import { isNonEmptyString } from "@acdh-oeaw/lib";
import type { DariahCampusCurriculum, DariahCampusResource } from "@acdh-knowledge-base/client-campus";
import type { ResourceDocument } from "@acdh-knowledge-base/search";

import { toPlainText } from "./markdown/to-plain-text";

export function createCampusResource(item: DariahCampusResource): ResourceDocument {
	const source = "dariah-campus" as const;
	const sourceId = item.id;
	const id = [source, sourceId].join(":");
	const authors = [...item.authors, ...item.editors].map((person) => person.name);
	const keywords = item.tags.map((tag) => tag.name);
	const year = isNonEmptyString(item["publication-date"])
		? new Date(item["publication-date"]).getFullYear()
		: null;
	const links = isNonEmptyString(item.pid) ? [item.pid] : [];
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
	const links = isNonEmptyString(item.pid) ? [item.pid] : [];
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
