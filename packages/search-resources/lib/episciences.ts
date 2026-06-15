import type { EpisciencesSearchDocument } from "@acdh-knowledge-base/client-episciences";
import type { ResourceDocument } from "@acdh-knowledge-base/search";

export function createEpisciencesDocument(item: EpisciencesSearchDocument): ResourceDocument {
	const source = "episciences" as const;
	const sourceId = String(item.docid ?? item.paperid);
	const id = [source, sourceId].join(":");
	const authors = item.author_fullname_s ?? [];
	const keywords = item.keyword_t ?? [];
	const title =
		Array.isArray(item.paper_title_t) && item.paper_title_t.length > 0
			? item.paper_title_t[0]!
			: (item.en_paper_title_t ?? "");
	const description =
		Array.isArray(item.abstract_t) && item.abstract_t.length > 0
			? item.abstract_t[0]!
			: (item.en_abstract_t ?? "");
	const year =
		item.publication_date_year_fs != null
			? Number(item.publication_date_year_fs)
			: item.publication_date_tdate != null
				? new Date(item.publication_date_tdate).getFullYear()
				: null;
	const doi = item.doi_s ?? null;
	const links =
		item.es_doc_url_s != null
			? [item.es_doc_url_s]
			: item.es_pdf_url_s != null
				? [item.es_pdf_url_s]
				: doi != null
					? [`https://doi.org/${doi}`]
					: [];

	return {
		id,
		source,
		source_id: sourceId,
		source_updated_at:
			item.es_publication_date_tdate != null
				? new Date(item.es_publication_date_tdate).getTime()
				: null,
		imported_at: Date.now(),
		type: "publication",
		label: title,
		description,
		links,
		keywords,
		kind: null,
		national_consortia: [],
		working_groups: [],
		institutions: [],
		upstream_sources: null,
		authors,
		year: year != null && !Number.isNaN(year) ? year : null,
		pid: doi,
	};
}
