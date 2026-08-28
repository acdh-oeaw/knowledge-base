// NOTE: Duplicated from `apps/knowledge-base/lib/embed-url.ts`. Keep the two copies in sync; if a
// third consumer appears, promote this into a shared package instead.

/**
 * Normalises a YouTube URL to a privacy-friendly `youtube-nocookie.com` embed URL for use as an
 * `<iframe src>`.
 *
 * Handles the common share/watch formats — `watch?v=`, `youtu.be/`, `/shorts/`, and existing
 * `/embed/` URLs (on either the regular or the nocookie host) — across the `www`, `m`, and `music`
 * subdomains. A `t`/`start` timestamp is carried over as the embed `start` param (in seconds), so
 * `?t=1m30s` becomes `?start=90`.
 *
 * Returns the input unchanged when it isn't a recognised YouTube URL (e.g. Vimeo), so non-YouTube
 * embeds keep working.
 */
export function getEmbedUrl(url: string): string {
	const parsed = parseUrl(url);
	if (parsed == null) {
		return url;
	}

	const videoId = getYouTubeVideoId(parsed);
	if (videoId == null) {
		return url;
	}

	const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
	const start = getStartSeconds(parsed);
	if (start != null) {
		embedUrl.searchParams.set("start", String(start));
	}

	return embedUrl.href;
}

/** Parses `url`, retrying with an `https://` prefix so schemeless pastes still work. */
function parseUrl(url: string): URL | null {
	try {
		return new URL(url);
	} catch {
		try {
			return new URL(`https://${url}`);
		} catch {
			return null;
		}
	}
}

const validVideoId = /^[\w-]+$/;

function getYouTubeVideoId(url: URL): string | null {
	const host = url.hostname.replace(/^(?:www|m|music)\./, "");

	let id: string | null | undefined;
	if (host === "youtu.be") {
		id = url.pathname.split("/")[1];
	} else if (host === "youtube.com" || host === "youtube-nocookie.com") {
		const [, first, second] = url.pathname.split("/");
		if (first === "watch") {
			id = url.searchParams.get("v");
		} else if (first === "shorts" || first === "embed") {
			id = second;
		}
	}

	return id != null && validVideoId.test(id) ? id : null;
}

/** YouTube start times can be bare seconds (`90`), `90s`, or `1h2m3s`; the embed needs seconds. */
const durationParts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;

function getStartSeconds(url: URL): number | null {
	const value = url.searchParams.get("t") ?? url.searchParams.get("start");
	if (value == null) {
		return null;
	}

	if (/^\d+$/.test(value)) {
		const seconds = Number(value);
		return seconds > 0 ? seconds : null;
	}

	const match = durationParts.exec(value);
	if (match == null) {
		return null;
	}

	const [, hours, minutes, seconds] = match;
	if (hours == null && minutes == null && seconds == null) {
		return null;
	}

	const total = Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
	return total > 0 ? total : null;
}
