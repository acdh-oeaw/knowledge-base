export const maxLimit = 100;

export const imageWidth = {
	avatar: 400,
	featured: 1600,
	preview: 800,
};

/**
 * Version segment in every image-variant url.
 *
 * Signed imgproxy urls are derived from `IMGPROXY_KEY`/`IMGPROXY_SALT`, so rotating either
 * invalidates every signature at once. The variant endpoint answers with a permanently cacheable
 * redirect, which a browser will happily keep following to a url imgproxy now rejects — and no
 * cache can be reached to flush it. Bumping this changes every emitted url, so a rotation is a
 * one-line change made in the same deploy rather than an outage that has to expire on its own.
 */
export const imageVariantVersion = "v1";

/**
 * The widths the variant endpoint will render, in css pixels of source resolution.
 *
 * A ladder rather than arbitrary values: each rung is a distinct imgproxy render and a distinct
 * cache entry, so an open endpoint that honoured any width would let a caller inflate both without
 * limit. Consumers snap up to the nearest rung, which keeps this list short no matter what widths
 * their layouts actually use.
 *
 * The top rung is set by the landing-page hero, which is laid out at 1920 css pixels and wants
 * twice that on a 2x display. Higher-density displays are not chased: the big slots are on
 * desktops, which are 1x or 2x, while 3x devices are phones whose slots the lower rungs cover.
 */
export const imageVariantWidths = [320, 480, 640, 960, 1280, 1600, 2048, 2560, 3200, 3840] as const;

/**
 * The aspect ratios the variant endpoint will crop to, as `width / height`.
 *
 * Deliberately a small set the layouts snap to, rather than one entry per slot. The consuming
 * website currently renders ten distinct ratios, all of them arrived at by fitting a box and
 * letting `object-cover` absorb the difference — reproducing that here would move the same
 * arbitrariness onto the server and multiply the cache surface for no gain.
 *
 * Omitting the ratio is a first-class mode, not a fallback: it scales to width and does not crop,
 * which is what a letterboxed slot (`object-contain`) and a "view full size" link both need.
 */
export const imageVariantAspectRatios = {
	"1x1": 1,
	"3x2": 3 / 2,
	"16x9": 16 / 9,
	/** The banner ratio the wide card and hero slots (~2.15–2.23) snap to. */
	"21x9": 21 / 9,
} as const;

export type ImageVariantAspectRatio = keyof typeof imageVariantAspectRatios;
