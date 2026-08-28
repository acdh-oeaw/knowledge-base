import { Readable } from "node:stream";

import { getContentDispositionHeader } from "@dariah-eric/storage/download";
import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest): Promise<NextResponse> {
	const { session } = await getCurrentSession();

	if (session == null) {
		return new NextResponse(null, { status: 401 });
	}

	const key = request.nextUrl.searchParams.get("key");

	if (key == null) {
		return new NextResponse(null, { status: 400 });
	}

	const asset = await db.query.assets.findFirst({
		where: { key },
		columns: { filename: true, key: true, label: true, mimeType: true },
	});

	if (asset == null) {
		return new NextResponse(null, { status: 404 });
	}

	const stream = (await storage.download(key)).unwrap();

	const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;

	return new NextResponse(webStream, {
		headers: {
			// Always an attachment: this backs an explicit "Download" button, so it should save rather
			// than take over the tab, whatever the file is.
			"Content-Disposition": getContentDispositionHeader(asset, "attachment"),
			"Content-Type": "application/octet-stream",
		},
	});
}
