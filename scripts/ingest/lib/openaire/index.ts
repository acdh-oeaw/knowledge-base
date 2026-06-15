import type { ResearchProduct } from "@acdh-knowledge-base/client-openaire";
import type { ResourceDocument } from "@acdh-knowledge-base/search";

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

	return {
		id,
		source,
		source_id: sourceId,
		source_updated_at: item.lastUpdateTimeStamp,
		imported_at: Date.now(),
		type: "publication",
		label: item.mainTitle,
		description: item.descriptions?.join("\n") ?? "",
		links: [],
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
