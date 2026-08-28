import type { ResearchProduct } from "@dariah-eric/client-openaire";
import type { ResourceDocument } from "@dariah-eric/search";

export function createOpenAirePublication(item: ResearchProduct): ResourceDocument {
	const keywords = [];

	if (item.subjects != null) {
		for (const subject of item.subjects) {
			if (subject.subject.scheme === "keyword") {
				keywords.push(subject.subject.value);
			}
		}
	}

	const source = "open-aire";
	const sourceId = item.id;
	const id = [source, sourceId].join(":");

	/** OpenAIRE Explore result page (the ingest source website / aggregator). */
	const source_url = `https://explore.openaire.eu/search/result?id=${sourceId}`;

	/** External urls pointing to where the actual resource lives. */
	const links = [...new Set((item.instances ?? []).flatMap((instance) => instance.urls ?? []))];

	return {
		id,
		source,
		source_id: sourceId,
		source_updated_at: item.lastUpdateTimeStamp,
		imported_at: Date.now(),
		type: "publication",
		label: item.mainTitle,
		description: item.descriptions?.join("\n") ?? "",
		source_url,
		links,
		keywords,
		kind: null,
		national_consortia: [],
		working_groups: [],
		institutions: [],
		upstream_sources: null,
		authors: [],
		year: null,
		pid: null,
	};
}
