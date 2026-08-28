import { isNonEmptyString } from "@acdh-oeaw/lib";
import type { HalDocument } from "@dariah-eric/client-hal";
import type { ResourceDocument } from "@dariah-eric/search";

export interface HalIngestDocument extends HalDocument {
	abstract_s?: string;
	authFullName_s?: Array<string> | string;
	docType_s?: string;
	label_s?: string;
	keyword_s?: Array<string> | string;
	modificationDate_tdate?: string | null;
	producedDateY_i?: number | string | null;
	submittedDate_tdate?: string | null;
	title_s?: string;
	uri_s?: Array<string> | string;
}

function toArray(value: Array<string> | string | undefined): Array<string> {
	if (value == null) {
		return [];
	}

	return Array.isArray(value) ? value : [value];
}

/** @see {@link https://api.archives-ouvertes.fr/docs/search} */
export function createHalItem(item: HalIngestDocument): ResourceDocument {
	const authors = toArray(item.authFullName_s).filter((value) => isNonEmptyString(value));
	const keywords = toArray(item.keyword_s).filter((value) => isNonEmptyString(value));
	const uris = toArray(item.uri_s).filter((value) => isNonEmptyString(value));
	const year =
		(typeof item.producedDateY_i === "number"
			? item.producedDateY_i
			: item.producedDateY_i != null
				? Number(item.producedDateY_i)
				: Number.NaN) || null;
	const sourceUpdatedAt =
		item.modificationDate_tdate != null
			? new Date(item.modificationDate_tdate).getTime()
			: item.submittedDate_tdate != null
				? new Date(item.submittedDate_tdate).getTime()
				: null;

	const source = "hal";
	const sourceId = String(item.docid);
	const id = [source, sourceId].join(":");

	const sourceUrl = uris[0] ?? `https://hal.science/hal-${sourceId}`;
	const links = uris.slice(1);

	return {
		id,
		source,
		source_id: sourceId,
		source_updated_at: sourceUpdatedAt,
		imported_at: Date.now(),
		type: "publication",
		label: item.title_s ?? item.label_s ?? "",
		description: item.abstract_s ?? "",
		source_url: sourceUrl,
		links,
		keywords,
		kind: item.docType_s ?? null,
		national_consortia: [],
		working_groups: [],
		institutions: [],
		upstream_sources: null,
		authors,
		year,
		pid: null,
	};
}
