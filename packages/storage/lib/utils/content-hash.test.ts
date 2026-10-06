import { describe, expect, it } from "vitest";

import { getContentHash } from "./content-hash";

describe("getContentHash", () => {
	it("returns the hex-encoded sha-256 digest", () => {
		expect(getContentHash(Buffer.from("abc"))).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	it("returns the same digest for identical bytes", () => {
		expect(getContentHash(Buffer.from([1, 2, 3]))).toBe(getContentHash(Buffer.from([1, 2, 3])));
	});
});
