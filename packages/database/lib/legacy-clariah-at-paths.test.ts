import { describe, expect, it } from "vitest";

import { getLegacyClariahAtAliasEntity, legacyClariahAtAliases } from "./legacy-clariah-at-paths";

describe("legacyClariahAtAliases", () => {
	it("only points at items the old website had", () => {
		for (const id of Object.keys(legacyClariahAtAliases)) {
			expect(getLegacyClariahAtAliasEntity(id), id).not.toBeNull();
		}
	});

	it("ignores other path segments", () => {
		expect(getLegacyClariahAtAliasEntity("some-wordpress-post")).toBeNull();
		expect(getLegacyClariahAtAliasEntity("constructor")).toBeNull();
	});
});
