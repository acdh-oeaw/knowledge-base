import type { AsyncOption } from "@acdh-knowledge-base/ui/use-async-options";

export interface PersonOption {
	documentId: string;
	name: string;
	description: string;
	/** Entity slug, used to build detail-page hrefs. */
	slug: string;
}

export interface PersonDocumentOption extends AsyncOption {
	documentId: string;
	/** Entity slug, used to build detail-page hrefs. */
	slug: string;
}

export function toPersonDocumentOption(option: PersonOption): PersonDocumentOption {
	return {
		...option,
		id: option.documentId,
	};
}

export function toPersonDocumentOptionsPage(result: {
	items: Array<PersonOption>;
	total: number;
}): {
	items: Array<PersonDocumentOption>;
	total: number;
} {
	return {
		items: result.items.map(toPersonDocumentOption),
		total: result.total,
	};
}
