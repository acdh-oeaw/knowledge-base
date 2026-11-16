# CLARIAH-AT website: crop images around their focal point

Handoff for the website side of image focal points, in
[`acdh-oeaw/clariah-at-platform`](https://github.com/acdh-oeaw/clariah-at-platform). The knowledge
base and its public API are done (#22). Nothing breaks without this work: until the website uses the
focal point, crops stay centred, as they are now.

## What the api sends

Every `Image` in API responses has a `focalPoint`: the point editors chose to keep in view when the
image is cropped.

```jsonc
{
	"url": "…",
	"srcUrl": "…",
	"width": 2400,
	"height": 1600,
	"aspectRatio": 1.5,
	// fractions of the source width and height from the top left, each 0–1; null means the centre
	"focalPoint": { "x": 0.3, "y": 0.25 },
	"mimeType": "image/jpeg",
	"alt": "…",
	// …
}
```

Editors set it in the asset metadata dialog. It belongs to the asset, like alt text, so it applies
wherever the image is used.

## The rule

The website crops with `object-fit: cover`. Apply the focal point as

```css
object-position: calc(x * 100%) calc(y * 100%);
```

for example `object-position: 30% 25%`, and leave the default (`50% 50%`) when `focalPoint` is null.

This is CSS's own placement rule, and the dashboard's crop previews use exactly the same rule. So
what editors see in the dialog is what the website shows, as long as the website uses
`object-position` this way.

## What to build

1. **Types.** Run `pnpm run generate:openapi` against an API that includes #22, so the generated
   client types include `focalPoint`. Add `focalPoint?: { x: number; y: number } | null` to
   `ImageAsset` in `lib/images/variants.ts`.

2. **`ApiImage`** (`components/image.tsx`). Set `objectPosition` from `image.focalPoint` in `style`,
   merged with any `style` the caller passes, so every caller gets it. `object-position` has no
   effect without `object-fit: cover`, so this is safe for images that are not cropped:

   ```tsx
   const objectPosition =
   	image.focalPoint != null
   		? `${String(image.focalPoint.x * 100)}% ${String(image.focalPoint.y * 100)}%`
   		: undefined;
   const style = objectPosition != null ? { objectPosition, ...rest.style } : rest.style;
   ```

   Pass `style` to every render path: the plain `<img>` fallback and both `NextImage` paths. A caller
   that sets `objectPosition` itself still wins.

3. **Check the places that crop.** These use `object-cover` today and should follow the point once
   `ApiImage` sets it:

   - `components/card.tsx`: news, project and featured cards, fixed 14rem tall.
   - `app/(app)/[locale]/_components/detail-card.tsx`: the detail page header (`aspect-[2/1]`,
     capped at `max-h-100`).
   - `app/(app)/[locale]/(default)/events/_components/event-card.tsx`: 16:9 on phones, 4:3 from `sm`.
   - `components/content-blocks.tsx`: the media-and-text thumbnail (`max-block-56 object-cover`).
   - Portraits in the quote block's byline, once that is built (see
     [`clariah-at-website-quote-block.md`](./clariah-at-website-quote-block.md)).

4. **Tests.** A Playwright check that a card's image has the expected `object-position` for an asset
   with a focal point, and none (or `50% 50%`) without one.

## Crop previews in the dashboard

For photos (`images/` prefix), the asset dialog previews these crop shapes, based on the slots above:

- **4:3**: event cards, and news or project cards on the narrowest phones.
- **2:1**: the detail page header.
- **3:1**: the detail page header on wide screens, and single-column cards just below two columns.

Portraits (`avatars/`) preview at 1:1. Logos (`logos/`) have no focal point picker, since they are
never cropped.

If the website's image slots change shape significantly, update `imageCrops` in
`apps/knowledge-base/lib/focal-point.ts` in the knowledge base, so editors keep seeing the crops the
website actually makes.

## Not needed

- **Link previews (`og:image`):** the website sends the whole image, not a crop, so the focal point
  does not apply. If it ever requests a cropped rendition with `&ar=`, the API already crops it
  around the focal point. Pass the point as `&fp=x,y` too, so a moved point gets a new url instead
  of the cached old crop.
- **SVGs:** imgproxy does not process them, but `object-position` works on them in the browser like
  on any other image.
