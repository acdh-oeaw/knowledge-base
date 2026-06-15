import { extname } from "node:path";
import { Readable } from "node:stream";

import slugify from "@sindresorhus/slugify";
import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

const mimeTypeExtensions = new Map([
	["application/pdf", ".pdf"],
	["application/msword", ".doc"],
	["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
	["application/vnd.ms-excel", ".xls"],
	["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
	["application/vnd.ms-powerpoint", ".ppt"],
	["application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx"],
	["text/plain", ".txt"],
]);

function getDownloadFilename(asset: {
	filename: string | null;
	key: string;
	label: string;
	mimeType: string;
}) {
	if (asset.filename != null) {
		return asset.filename;
	}

	const extension = (extname(asset.key) || mimeTypeExtensions.get(asset.mimeType)) ?? "";

	return `${slugify(asset.label)}${extension}`;
}

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

	const filename = getDownloadFilename(asset);

	const stream = (await storage.download(key)).unwrap();

	const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;

	return new NextResponse(webStream, {
		headers: {
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Content-Type": "application/octet-stream",
		},
	});
}
