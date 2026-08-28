import { describe, expect, it } from "vitest";

import { getEmbedUrl } from "@/lib/embed-url";

const embed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}`;

describe("getEmbedUrl", () => {
	it("normalises a standard watch URL", () => {
		expect(getEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(embed("dQw4w9WgXcQ"));
	});

	it("extracts the `v` param regardless of its position in the query string", () => {
		expect(getEmbedUrl("https://www.youtube.com/watch?list=abc&v=dQw4w9WgXcQ&index=2")).toBe(
			embed("dQw4w9WgXcQ"),
		);
	});

	it("handles `youtu.be` short links", () => {
		expect(getEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(embed("dQw4w9WgXcQ"));
	});

	it("handles `/shorts/` URLs", () => {
		expect(getEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(embed("dQw4w9WgXcQ"));
	});

	it("normalises existing embed URLs to the nocookie host", () => {
		expect(getEmbedUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(embed("dQw4w9WgXcQ"));
		expect(getEmbedUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe(
			embed("dQw4w9WgXcQ"),
		);
	});

	it("handles `m.` and `music.` subdomains", () => {
		expect(getEmbedUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(embed("dQw4w9WgXcQ"));
		expect(getEmbedUrl("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(embed("dQw4w9WgXcQ"));
	});

	it("normalises schemeless URLs", () => {
		expect(getEmbedUrl("youtube.com/watch?v=dQw4w9WgXcQ")).toBe(embed("dQw4w9WgXcQ"));
		expect(getEmbedUrl("youtu.be/dQw4w9WgXcQ")).toBe(embed("dQw4w9WgXcQ"));
	});

	it("carries over the timestamp as `start` seconds", () => {
		const withStart = (id: string, s: number) => `${embed(id)}?start=${String(s)}`;

		expect(getEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42")).toBe(
			withStart("dQw4w9WgXcQ", 42),
		);
		expect(getEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe(
			withStart("dQw4w9WgXcQ", 42),
		);
		expect(getEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=1m30s")).toBe(withStart("dQw4w9WgXcQ", 90));
		expect(getEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s")).toBe(
			withStart("dQw4w9WgXcQ", 3723),
		);
	});

	it("ignores an unparseable or zero timestamp", () => {
		expect(getEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=0")).toBe(embed("dQw4w9WgXcQ"));
		expect(getEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=abc")).toBe(embed("dQw4w9WgXcQ"));
	});

	it("returns non-YouTube URLs unchanged", () => {
		expect(getEmbedUrl("https://vimeo.com/123456789")).toBe("https://vimeo.com/123456789");
		expect(getEmbedUrl("https://example.com/foo")).toBe("https://example.com/foo");
	});

	it("returns unparseable input unchanged", () => {
		expect(getEmbedUrl("not a url")).toBe("not a url");
	});
});
