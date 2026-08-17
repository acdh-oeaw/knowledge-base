import { isNonEmptyArray, isNonEmptyString } from "@acdh-oeaw/lib";
import type { ZenodoRecord } from "@dariah-eric/client-zenodo";
import type { ResourceDocument } from "@dariah-eric/search";

/** @see {@link https://developers.zenodo.org/} */
/** @see {@link https://zenodo.org/communities/dariah} */
export function createZenodoItem(item: ZenodoRecord): ResourceDocument {
	const authors = item.metadata.creators
		.map((creator) => creator.name.trim())
		.filter((name) => isNonEmptyString(name));

	const keywords =
		[item.metadata.keywords, item.metadata.keyword].find((value) => isNonEmptyArray(value)) ?? [];

	// oxlint-disable-next-line unicorn/consistent-function-scoping
	function resolveLink(link: string | Record<string, string> | undefined): string | undefined {
		if (link == null) {
			return undefined;
		}
		return typeof link === "string" ? link : link.href;
	}

	const links = [
		resolveLink(item.links.html) ??
			resolveLink(item.links.self) ??
			`https://zenodo.org/records/${String(item.id)}`,
	];
	const sourceId = item.conceptrecid ?? String(item.id);
	const id = ["zenodo", sourceId].join(":");
	const publicationDate = item.metadata.publication_date ?? item.metadata.published;
	const year = publicationDate != null ? new Date(publicationDate).getFullYear() : null;
	const sourceUpdatedAt =
		item.modified != null
			? new Date(item.modified).getTime()
			: item.created != null
				? new Date(item.created).getTime()
				: null;

	return {
		id,
		source: "zenodo",
		source_id: sourceId,
		source_updated_at: sourceUpdatedAt,
		imported_at: Date.now(),
		type: "publication",
		label: item.metadata.title,
		description: item.metadata.description ?? "",
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
