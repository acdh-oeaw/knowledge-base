# CLARIAH-AT website: render the `quoteBlock` rich-text node

Handoff for the website side of quotes with attribution, in
[`acdh-oeaw/clariah-at-platform`](https://github.com/acdh-oeaw/clariah-at-platform). The knowledge
base and its public API are done (#20).

[`website-quote-block-renderer.md`](./website-quote-block-renderer.md) is the same handoff for the
DARIAH website. Its **What the api sends** section is the API contract and applies here unchanged.
This document covers what is different for the CLARIAH-AT website.

## Why this is urgent

The website renders rich text with `renderToReactElement` from `@tiptap/static-renderer`, using the
schema from `createRichTextExtensions` (`lib/rich-text-extensions.ts`). It passes no `unhandledNode`
fallback. So a node type the schema does not declare is not skipped: `Node.fromJSON` throws
`Unknown node type: quoteBlock`, and the whole rich-text field fails to render.

A `quoteBlock` reaches the website as soon as either of these happens:

- an editor inserts "Quote with attribution" from a content field's insert menu or `/` slash menu;
- someone runs `pnpm data:convert:legacy-blockquotes --apply`, which turns legacy blockquotes with a
  recognisable byline into `quoteBlock`s.

**Do not run the conversion with `--apply` against an environment the website reads until the
website ships the changes below.** A dry run (without `--apply`) is safe and writes a TSV report of
what would change.

## What the api sends

See [What the api sends](./website-quote-block-renderer.md#what-the-api-sends). In short: a block
node with `content: paragraph+`, plus `attrs.authors` (an array, possibly empty) and
`attrs.description` (`{ doc > paragraph }` rich text, or null).

Differences for CLARIAH-AT:

- **Person authors have no link.** `authors[].entity.href` is always `null` for persons, because
  the CLARIAH-AT website has no person pages (`getWebsiteHref` in the API returns `null` for
  `persons`). Render the name as plain text. Still check `href` rather than assuming it is null, in
  case person pages are added later.
- **Images** are the API's usual `Image` shape at avatar width (400px). That includes `focalPoint`,
  see [`clariah-at-website-focal-point.md`](./clariah-at-website-focal-point.md).

## What to build

1. **Schema.** In `lib/rich-text-extensions.ts`, declare the node and add it to
   `createRichTextExtensions`:

   ```ts
   const QuoteBlock = Node.create({
   	name: "quoteBlock",
   	group: "block",
   	content: "paragraph+",

   	addAttributes() {
   		return {
   			authors: { default: [] },
   			description: { default: null },
   		};
   	},
   });
   ```

   Both attributes must be declared: undeclared attributes are dropped when the JSON is read.

2. **Renderer.** In `components/rich-text.tsx`, add `quoteBlock` to `nodeMapping`. The website has
   no blockquote design of its own yet (a plain `blockquote` gets the typography plugin's `prose`
   styles), so this needs one. A suggested structure:

   ```tsx
   <figure>
   	<blockquote>{children}</blockquote>
   	{hasByline ? <figcaption>…authors, portraits, description…</figcaption> : null}
   </figure>
   ```

   - **Authors:** join the names with `Intl.ListFormat` in the page locale (`type: "conjunction"`).
     Wrap a name in a link only when its `entity.href` is non-null.
   - **Portraits:** show `image` for each author who has one, small and round, through `ApiImage`
     (`components/image.tsx`) with `alt=""` (the name is written next to it) and a `sizes` that
     matches the rendered size. Apply the focal point, see the focal point handoff.
   - **Description:** render it with `InlineRichText` (the path captions and footnotes use), so its
     links and hard breaks work.
   - **Empty byline** (no authors and no description): render the quote without a `figcaption`.

   The blockquote must keep rendering as it does now; only `quoteBlock` is new.

3. **Plain text.** `toPlainText` in `lib/rich-text.ts` only walks `content`, so it skips the byline.
   That is fine for its current callers (page descriptions, heading anchors, gallery alt text). Add the author names only if a
   caller needs them.

4. **Safety net (optional).** Consider passing `unhandledNode` (and `unhandledMark`) to
   `renderToReactElement`, so that the next node type the CMS adds degrades to nothing, or to its
   children, instead of breaking the page.

5. **Tests.** The repository only has Playwright e2e tests (`e2e/`). Cover at least a quote with a
   person author and portrait, a typed-in author without a picture, a null description, an empty
   byline, and a plain `blockquote`.

## Checking it against real content

Before running the conversion, a quote can be authored in the knowledge-base dashboard ("Quote with
attribution" in a content field's insert menu or `/` slash menu) on an environment the website reads.

After the website has shipped, do a dry run of the conversion and check its TSV report. Then run it
with `--apply` and compare the converted pages. The conversion leaves quotes whose byline it cannot
recognise as plain blockquotes.

## Out of scope

- Links to knowledge-base pages inside the description: the editor only offers url links there, so
  they arrive as ordinary `href` links.
