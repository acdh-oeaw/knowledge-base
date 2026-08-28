import { type ResourceDocument, resourceServiceKinds, resourceTypes } from "@dariah-eric/search";
import type { SearchAdminService as Client } from "@dariah-eric/search/admin";
import { faker as f } from "@faker-js/faker";

export interface SeedConfig {
	/** @default "2025-01-01" */
	defaultRefDate?: Date;
	/** Default 42 */
	seed?: number;
}

export async function seed(client: Client, config: SeedConfig = {}): Promise<void> {
	const { defaultRefDate = new Date(Date.UTC(2025, 0, 1)), seed = 42 } = config;

	f.seed(seed);
	f.setDefaultRefDate(defaultRefDate);

	const types = resourceTypes;

	const documents = f.helpers.multiple<ResourceDocument>(
		() => {
			const type = f.helpers.arrayElement(types);

			const document = {
				id: f.string.uuid(),
				imported_at: f.date.past().getTime(),
				source_updated_at:
					f.helpers.maybe(() => f.date.past().getTime(), { probability: 0.6 }) ?? null,
				label: f.lorem.sentence(),
				description: f.lorem.paragraphs(2, "\n\n"),
				keywords: f.helpers.multiple(() => f.lorem.word(), { count: { min: 3, max: 8 } }),
				source_url: f.helpers.maybe(() => f.internet.url(), { probability: 0.8 }) ?? null,
				links: f.helpers.multiple(() => f.internet.url(), { count: { min: 0, max: 3 } }),
			} satisfies Partial<ResourceDocument>;

			switch (type) {
				case "publication": {
					return {
						...document,
						type,
						source: f.helpers.arrayElement(["open-aire", "zotero"]),
						source_id: f.string.alphanumeric(12),
						national_consortia: [],
						working_groups: [],
						institutions: [],
						upstream_sources: null,
						kind: f.helpers.arrayElement(["article", "book", "conference", "thesis", null]),
						authors: f.helpers.multiple(() => f.person.fullName(), { count: { min: 1, max: 5 } }),
						year: f.number.int({ min: 1990, max: 2024 }),
						pid: f.helpers.maybe(() => f.string.alphanumeric(10), { probability: 0.7 }) ?? null,
					};
				}

				case "service": {
					return {
						...document,
						type,
						source: "ssh-open-marketplace",
						source_id: f.string.alphanumeric(12),
						upstream_sources: null,
						kind: f.helpers.arrayElement(resourceServiceKinds),
						national_consortia: f.helpers.multiple(() => f.lorem.slug(2), {
							count: { min: 0, max: 2 },
						}),
						working_groups: f.helpers.multiple(() => f.lorem.slug(2), {
							count: { min: 0, max: 2 },
						}),
						institutions: f.helpers.multiple(() => f.lorem.slug(2), {
							count: { min: 0, max: 2 },
						}),
						authors: null,
						year: null,
						pid: null,
					};
				}

				case "software": {
					return {
						...document,
						type,
						source: "ssh-open-marketplace",
						source_id: f.string.alphanumeric(12),
						upstream_sources: null,
						kind: null,
						national_consortia: f.helpers.multiple(() => f.lorem.slug(2), {
							count: { min: 0, max: 2 },
						}),
						working_groups: f.helpers.multiple(() => f.lorem.slug(2), {
							count: { min: 0, max: 2 },
						}),
						institutions: f.helpers.multiple(() => f.lorem.slug(2), {
							count: { min: 0, max: 2 },
						}),
						authors: null,
						year: null,
						pid: null,
					};
				}

				case "training-material": {
					return {
						...document,
						type,
						source: "ssh-open-marketplace",
						source_id: f.string.alphanumeric(12),
						national_consortia: f.helpers.multiple(() => f.lorem.slug(2), {
							count: { min: 0, max: 2 },
						}),
						working_groups: f.helpers.multiple(() => f.lorem.slug(2), {
							count: { min: 0, max: 2 },
						}),
						institutions: f.helpers.multiple(() => f.lorem.slug(2), {
							count: { min: 0, max: 2 },
						}),
						upstream_sources: [],
						kind: null,
						authors: null,
						year: null,
						pid: null,
					};
				}

				case "workflow": {
					return {
						...document,
						type,
						source: "ssh-open-marketplace",
						source_id: f.string.alphanumeric(12),
						national_consortia: f.helpers.multiple(() => f.lorem.slug(2), {
							count: { min: 0, max: 2 },
						}),
						working_groups: f.helpers.multiple(() => f.lorem.slug(2), {
							count: { min: 0, max: 2 },
						}),
						institutions: f.helpers.multiple(() => f.lorem.slug(2), {
							count: { min: 0, max: 2 },
						}),
						upstream_sources: null,
						kind: null,
						authors: null,
						year: null,
						pid: null,
					};
				}
			}
		},
		{ count: 100 },
	);

	await client.collections.resources.ingest(documents);
}
