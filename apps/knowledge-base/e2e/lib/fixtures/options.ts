import type { Locator, Page } from "@playwright/test";

/** Matches the `[e2e-worker-N] …` names every worker gives the fixtures it creates. */
const WORKER_FIXTURE_PATTERN = /\[e2e-worker-\d+\]/;

/**
 * The "any option will do" pickers list every row in the database, so their dropdowns also contain
 * the fixtures the _other_ Playwright worker is creating and deleting right now. Selecting one of
 * those makes the test depend on another suite's teardown: the relation it just created disappears
 * together with the person, or the row it linked to can no longer be deleted. Seeded rows are the
 * only ones that outlive every worker, so these pickers skip anything worker-prefixed.
 */
export function firstSeededOption(scope: Locator | Page): Locator {
	return scope.getByRole("option").filter({ hasNotText: WORKER_FIXTURE_PATTERN }).first();
}

/**
 * Search term that matches the seeded (`Kitchen Sink …`) persons and nothing a worker creates. The
 * person pickers are backed by the search index, which returns one page of results — filtering an
 * unqualified query client-side could leave no seeded option on it at all, so narrow the query
 * instead of the result list.
 */
export const SEEDED_PERSON_SEARCH_TERM = "Kitchen Sink";
