import {
	type EpisciencesIntraWorkRelation,
	type EpisciencesPaper,
	type EpisciencesSearchDocument,
	defaultEpisciencesJournalCode,
} from "@dariah-eric/client-episciences";
import type { ResourceDocument } from "@dariah-eric/search";

function toArray<T>(value: T | Array<T> | undefined): Array<T> {
	if (value == null) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

function toRelationUrl(relation: EpisciencesIntraWorkRelation): string {
	return relation["@identifier-type"] === "doi"
		? `https://doi.org/${relation.value}`
		: relation.value;
}

/**
 * Episciences is an overlay journal: each paper points back to a deposit on an external repository
 * (HAL, Zenodo, arXiv, ...). That deposit is the `isSameAs` relation in the crossref metadata and
 * is what the journal website surfaces as its "Open on HAL"/"Open on Zenodo" link. Returns it as a
 * url (doi relations are resolved via `doi.org`, uri relations are used as-is).
 */
function getRepositoryLink(paper: EpisciencesPaper | undefined): string | null {
	const relations = toArray(paper?.document?.journal?.journal_article?.program).flatMap((program) =>
		toArray(program.related_item).flatMap((relatedItem) =>
			toArray(relatedItem.intra_work_relation),
		),
	);

	const deposit =
		relations.find((relation) => relation["@relationship-type"] === "isSameAs") ?? null;

	return deposit != null ? toRelationUrl(deposit) : null;
}

export function createEpisciencesDocument(
	item: EpisciencesSearchDocument,
	paper?: EpisciencesPaper,
): ResourceDocument {
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
	/** The journal DOI is only available on the full paper record, not in the search document. */
	const doi = paper?.document?.journal?.journal_article?.doi_data?.doi ?? item.doi_s ?? null;

	/**
	 * Episciences landing page for the document (the ingest source website). The search api does not
	 * reliably include `es_doc_url_s`, so fall back to building the canonical per-journal landing
	 * page url (`https://<journal-code>.episciences.org/<docid>`) from the available fields.
	 */
	const journalCode = item.revue_code_t ?? defaultEpisciencesJournalCode;
	const source_url =
		item.es_doc_url_s ??
		(item.docid != null ? `https://${journalCode}.episciences.org/${String(item.docid)}` : null);

	/** The journal DOI and the external repository deposit the paper overlays. */
	const links: Array<string> = [];
	if (doi != null) {
		links.push(`https://doi.org/${doi}`);
	}
	const repositoryLink = getRepositoryLink(paper);
	if (repositoryLink != null) {
		links.push(repositoryLink);
	}

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
		source_url,
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
