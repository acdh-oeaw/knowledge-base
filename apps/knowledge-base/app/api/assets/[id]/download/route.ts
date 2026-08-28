import { Readable } from "node:stream";

import { getContentDispositionHeader } from "@dariah-eric/storage/download";
import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { getAssetForDownload } from "@/lib/data/assets";
import { enforceApiGetRateLimit } from "@/lib/server/api-rate-limit";
import { storage as s3 } from "@/lib/storage";

/**
 * Streams the original bytes of a single asset as a file download. Admin-only — used by the
 * maintenance "unused assets" cleanup so an administrator can back up assets before removing them.
 */
export async function GET(
	_request: NextRequest,
	context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
	const rateLimitResponse = await enforceApiGetRateLimit();
	if (rateLimitResponse != null) {
		return rateLimitResponse;
	}

	const { session, user } = await getCurrentSession();

	if (session == null) {
		return new NextResponse(null, { status: 401 });
	}

	if (user.role !== "admin") {
		return new NextResponse(null, { status: 403 });
	}

	const { id } = await context.params;

	const asset = await getAssetForDownload(id);

	if (asset == null) {
		return new NextResponse(null, { status: 404 });
	}

	const download = await s3.download(asset.key);

	if (download.isErr()) {
		return new NextResponse(null, { status: 502 });
	}

	const body = Readable.toWeb(download.value) as unknown as ReadableStream<Uint8Array>;

	return new NextResponse(body, {
		headers: {
			"Content-Type": asset.mimeType,
			"Content-Disposition": getContentDispositionHeader(
				{ ...asset, label: "download" },
				"attachment",
			),
		},
	});
}
