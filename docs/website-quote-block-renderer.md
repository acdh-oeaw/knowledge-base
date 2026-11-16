# Website: render the `quoteBlock` rich-text node

Handoff for implementing the website side of quotes with attribution
([knowledge-base#958](https://github.com/DARIAH-ERIC/knowledge-base/issues/958)). The knowledge base
and its public API are done; this work happens in
[`DARIAH-ERIC/dariah-website`](https://github.com/DARIAH-ERIC/dariah-website).

## Background

Editors could previously only use a plain `blockquote`, and typed the attribution in as prose — the
last paragraph of the quote (`— Kiki Czeitschner, Senior Scientist, ACDH-CH`), or a paragraph right
after it (`Robin Luger (University of Vienna): Report on …`). The website guesses that byline back
out of the text today (`renderBlockquoteNode` and `parseByline` in `components/rich-text.tsx`).

The knowledge base now has a dedicated `quoteBlock` node with a structured byline: any number of
authors in order — people in the knowledge base by reference, anybody else by name, each optionally
with a picture — and a richtext description of who they are, which may contain links. A maintenance
script (`data:convert:legacy-blockquotes`) converts the legacy blockquotes whose byline matches one
of the two shapes above, so after it has run most attributed quotes arrive as `quoteBlock`.

Plain `blockquote` stays valid (quotations nobody is credited with) and must keep rendering as it
does now.

## What the api sends

`quoteBlock` appears inside the Tiptap JSON of a `rich_text` content block's `content`, like any
other block node — at the top level, or nested inside a list item or a table cell. It is never its
own content block. The resolution happens in the api (`annotateQuoteAuthors` in
`apps/api/src/lib/content-blocks.ts`); the `rich_text` schema's description documents it too, so
`generate:openapi` picks the wording up.

```jsonc
{
	"type": "quoteBlock",
	"attrs": {
		"authors": [
			{
				"kind": "person",
				"entityId": "0190…", // document id
				"name": "Ada Lovelace", // current name; the stored one if the person is unpublished
				"entity": {
					// `EntityRef`, or null once the person is no longer published
					"id": "0190…",
					"type": "persons",
					"slug": "ada-lovelace",
					"label": "Ada Lovelace",
					"href": "/persons/ada-lovelace", // root-relative, locale-less; may be null
				},
				"image": {/* `Image`, or null */},
			},
			{
				"kind": "text",
				"name": "Charles Babbage",
				"image": {/* `Image`, or null */},
			},
		],
		// `{ doc > paragraph }` richtext — the same shape as a caption or a footnote's note —
		// or null. May hold links (plain `href` links only) and hard breaks.
		"description": {
			"type": "doc",
			"content": [
				{
					"type": "paragraph",
					"content": [{ "type": "text", "text": "Senior Scientist, ACDH-CH" }],
				},
			],
		},
	},
	// The quoted text: one or more paragraphs, nothing else.
	"content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "A quotation." }] }],
}
```

Guarantees:

- `authors` is always an array, possibly empty, in the order the editor set. Malformed entries are
  dropped by the api.
- Images are the api's usual `Image` shape (`url`, `srcUrl`, `width`, `height`, `focalPoint`, `alt`,
  …), signed at the api's avatar width (400px). `width`/`height` are the _source's_ dimensions.
- `description` may be null. An empty byline (no authors, no description) is possible; render the
  quote without a footer then.
- The quoted text never contains images or other blocks — `content` is `paragraph+`.

## What to build

1. **Schema** — declare the node in `createRichTextExtensions` (`lib/rich-text-extensions.ts`), with
   `group: "block"`, `content: "paragraph+"`, and `authors` (default `[]`) and `description` (default
   `null`) attributes. An undeclared node, or an undeclared attribute, is dropped when the static
   renderer reads the JSON, so this step is not optional.
2. **Renderer** — add `quoteBlock` to `nodeMapping` in `components/rich-text.tsx`. Reuse the
   blockquote's design (`renderBlockquoteNode`: gradient panel, quote mark, `footer` with `cite` for
   the name and a line below for the role), but read the byline from the attributes instead of
   parsing the last paragraph:
   - authors: names joined as a list (`Intl.ListFormat` with the page locale, conjunction); each
     `person` with a non-null `entity.href` links to their page, built the way other `EntityRef`s are
     (see `position.entity.href` in `app/(app)/(default)/persons/[slug]/page.tsx`, which goes
     through `unsafeHref`);
   - portraits: show `image` for every author who has one, small and round, decorative (`alt=""`,
     since the name is written next to it), through `ApiImage` (`components/api-image.tsx`) with a
     `sizes` matching the rendered size;
   - description: render with `InlineRichText` (the same path captions use), so its links work.
   - Keep the typography rules the blockquote renderer documents (curly quotes on the quoted
     paragraphs, `[quotes:none]` when the content already opens with a quote mark, authored italics
     set upright).
3. **Plain text** — `toPlainText` in `lib/rich-text.ts` only walks `content`, so the byline is
   skipped. That is fine for its current callers (iframe titles, page descriptions); add the author
   names only if a caller turns out to need them.
4. **Tests** — extend `tests/unit/rich-text.test.ts`: a quote with a person author (linked, with
   portrait), a typed-in author without a picture, a null description, and an empty byline. Also
   check that a plain `blockquote` still renders as before.

## Checking it against real content

The converted legacy quotes are good fixtures once the conversion has run on an environment the
website points at:

- the Thierry Declerck tribute news items (in-quote bylines, several per page, German and English);
- the CLARIAH-AT travel grant page (bylines that used to follow the quote, with long descriptions
  containing hard breaks).

Before that, a quote can be authored in the knowledge base's dashboard: the "Quote with attribution"
entry in a content field's insert menu or `/` slash menu.

## Out of scope

- Links to knowledge-base pages inside the description: the editor only offers url links there, so
  they arrive as ordinary `href` links.
- Removing `parseByline`: unconverted legacy blockquotes (the conversion skips ones whose byline it
  cannot recognise) still rely on it.
