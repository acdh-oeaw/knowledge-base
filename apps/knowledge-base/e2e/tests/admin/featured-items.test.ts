import type { AdminFeaturedItemsPage } from "@/e2e/lib/fixtures/admin-featured-items-page";
import type { DatabaseService } from "@/e2e/lib/fixtures/database-service";
import { expect, test } from "@/e2e/lib/test";

interface FeaturedIds {
	news: Array<string>;
	events: Array<string>;
}

/**
 * Drives one featured section (news or events). Both are `AsyncListSelect`s (isOrderable,
 * maxItems=3): selected items render as drag-reorderable rows, added via a searchable popover. The
 * two sections persist into the same singleton `site_metadata` row under separate `news` / `events`
 * keys, so each config resets and asserts only its own key.
 */
interface SectionConfig {
	label: string;
	getItems: (db: DatabaseService) => Promise<Array<{ id: string; name: string }>>;
	section: (page: AdminFeaturedItemsPage) => AdminFeaturedItemsPage["news"];
	reset: (db: DatabaseService, ids: Array<string>) => Promise<void>;
	/** Expected persisted shape when this section holds `ids` and the other is empty. */
	expected: (ids: Array<string>) => FeaturedIds;
}

const SECTION_CONFIGS: Array<SectionConfig> = [
	{
		label: "news items",
		getItems: (db) => db.getPublishedNewsItems(4),
		section: (page) => page.news,
		reset: (db, ids) => db.resetSiteMetadataFeaturedItems({ news: ids }),
		expected: (ids) => {
			return { news: ids, events: [] };
		},
	},
	{
		label: "events",
		getItems: (db) => db.getPublishedEvents(4),
		section: (page) => page.events,
		reset: (db, ids) => db.resetSiteMetadataFeaturedItems({ events: ids }),
		expected: (ids) => {
			return { news: [], events: ids };
		},
	},
];

/**
 * `site_metadata` is a singleton and `resetSiteMetadataFeaturedItems` rewrites the whole
 * `featured_item_ids` column, so every describe in this file mutates the same row. A per-describe
 * `mode: "serial"` is not enough: under `fullyParallel` the describes are still independent units
 * that can run concurrently in different workers, where one group's reset clobbers another group's
 * selection mid-test. `mode: "default"` at file level keeps all of them in one worker, in order.
 */
test.describe.configure({ mode: "default" });

for (const config of SECTION_CONFIGS) {
	test.describe(`website featured ${config.label}`, () => {
		let items: Array<{ id: string; name: string }> = [];

		test.beforeAll(async ({ db }) => {
			items = await config.getItems(db);
		});

		test.afterAll(async ({ db }) => {
			await db.resetSiteMetadataFeaturedItems({});
		});

		test("should save selected featured items in selection order", async ({
			createAdminFeaturedItemsPage,
			db,
		}) => {
			const [first, second] = items;
			await config.reset(db, []);

			const featuredPage = createAdminFeaturedItemsPage();
			const section = config.section(featuredPage);
			await featuredPage.goto();

			// Add in reverse title order to prove the saved order follows selection, not the sort.
			await section.addFeatured(second!.name);
			await section.addFeatured(first!.name);

			expect(await section.getFeaturedNames()).toStrictEqual([second!.name, first!.name]);

			await featuredPage.save();

			expect(await db.getSiteMetadataFeaturedItemIds()).toStrictEqual(
				config.expected([second!.id, first!.id]),
			);
		});

		test("should disable further options once the maximum of three is reached", async ({
			createAdminFeaturedItemsPage,
			db,
		}) => {
			const [first, second, third, fourth] = items;
			await config.reset(db, [first!.id, second!.id, third!.id]);

			const featuredPage = createAdminFeaturedItemsPage();
			const section = config.section(featuredPage);
			await featuredPage.goto();

			await expect(section.featuredRows()).toHaveCount(3);
			expect(await section.isOptionDisabled(fourth!.name)).toBe(true);
		});

		test("should remove a featured item", async ({ createAdminFeaturedItemsPage, db }) => {
			const [first, second] = items;
			await config.reset(db, [first!.id, second!.id]);

			const featuredPage = createAdminFeaturedItemsPage();
			const section = config.section(featuredPage);
			await featuredPage.goto();

			await section.removeFeatured(first!.name);

			expect(await section.getFeaturedNames()).toStrictEqual([second!.name]);

			await featuredPage.save();

			expect(await db.getSiteMetadataFeaturedItemIds()).toStrictEqual(
				config.expected([second!.id]),
			);
		});

		test("should persist a reordered selection", async ({ createAdminFeaturedItemsPage, db }) => {
			const [first, second, third] = items;
			await config.reset(db, [first!.id, second!.id, third!.id]);

			const featuredPage = createAdminFeaturedItemsPage();
			const section = config.section(featuredPage);
			await featuredPage.goto();

			// Move the first item down one position: [first, second, third] -> [second, first, third].
			await section.moveFeaturedDown(first!.name);

			expect(await section.getFeaturedNames()).toStrictEqual([
				second!.name,
				first!.name,
				third!.name,
			]);

			await featuredPage.save();

			expect(await db.getSiteMetadataFeaturedItemIds()).toStrictEqual(
				config.expected([second!.id, first!.id, third!.id]),
			);
		});
	});
}

// The two sections write into distinct keys of the same singleton row; this guards against one
// section's save clobbering the other's selection.
test.describe("website featured items - news and events together", () => {
	let newsItems: Array<{ id: string; name: string }> = [];
	let events: Array<{ id: string; name: string }> = [];

	test.beforeAll(async ({ db }) => {
		[newsItems, events] = await Promise.all([
			db.getPublishedNewsItems(2),
			db.getPublishedEvents(2),
		]);
	});

	test.afterAll(async ({ db }) => {
		await db.resetSiteMetadataFeaturedItems({});
	});

	test("should persist news and events independently", async ({
		createAdminFeaturedItemsPage,
		db,
	}) => {
		await db.resetSiteMetadataFeaturedItems({});

		const featuredPage = createAdminFeaturedItemsPage();
		await featuredPage.goto();

		await featuredPage.news.addFeatured(newsItems[0]!.name);
		await featuredPage.events.addFeatured(events[0]!.name);

		expect(await featuredPage.news.getFeaturedNames()).toStrictEqual([newsItems[0]!.name]);
		expect(await featuredPage.events.getFeaturedNames()).toStrictEqual([events[0]!.name]);

		await featuredPage.save();

		expect(await db.getSiteMetadataFeaturedItemIds()).toStrictEqual({
			news: [newsItems[0]!.id],
			events: [events[0]!.id],
		});
	});
});
