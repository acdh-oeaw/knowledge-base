import { isNonEmptyArray, isNonEmptyString } from "@acdh-oeaw/lib";
import type { ZenodoRecord } from "@dariah-eric/client-zenodo";
import type { ResourceDocument } from "@dariah-eric/search";

import { toPlainText } from "./html/to-plain-text";

/**
 * @see {@link https://developers.zenodo.org/}
 * @see {@link https://zenodo.org/communities/dariah}
 */
export function createZenodoRecord(item: ZenodoRecord): ResourceDocument {
	const source = "zenodo" as const;
	const sourceId = item.conceptrecid ?? String(item.id);
	const id = [source, sourceId].join(":");

	const authors = item.metadata.creators
		.map((creator) => creator.name.trim())
		.filter((name) => isNonEmptyString(name));

	const keywords =
		[item.metadata.keywords, item.metadata.keyword].find((value) => isNonEmptyArray(value)) ?? [];

	function resolveLink(link: string | Record<string, string> | undefined): string | undefined {
		if (link == null) {
			return undefined;
		}
		return typeof link === "string" ? link : link.href;
	}

	/** Zenodo record page (the ingest source website). Zenodo hosts the record itself. */
	const sourceUrl =
		resolveLink(item.links.html) ??
		resolveLink(item.links.self) ??
		`https://zenodo.org/records/${String(item.id)}`;

	/** External url pointing to where the record is citable. */
	const links = isNonEmptyString(item.doi) ? [`https://doi.org/${item.doi}`] : [];

	const description = isNonEmptyString(item.metadata.description)
		? toPlainText(item.metadata.description)
		: "";

	const publicationDate = item.metadata.publication_date ?? item.metadata.published;
	const year = isNonEmptyString(publicationDate) ? new Date(publicationDate).getFullYear() : null;
	const sourceUpdatedAt = isNonEmptyString(item.modified)
		? new Date(item.modified).getTime()
		: isNonEmptyString(item.created)
			? new Date(item.created).getTime()
			: null;

	return {
		id,
		source,
		source_id: sourceId,
		source_updated_at: sourceUpdatedAt,
		imported_at: Date.now(),
		type: "publication",
		label: item.metadata.title,
		description,
		source_url: sourceUrl,
		links,
		keywords,
		kind: item.metadata.resource_type?.type ?? null,
		national_consortia: [],
		working_groups: [],
		institutions: [],
		upstream_sources: null,
		authors,
		year,
		pid: item.doi ?? null,
	};
}
