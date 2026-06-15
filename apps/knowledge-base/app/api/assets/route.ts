import { type NextRequest, NextResponse } from "next/server";

import { imageGridOptions, mediaLibraryPageSize } from "@/config/assets.config";
import { getCurrentSession } from "@/lib/auth/session";
import { type AssetPrefix, assetPrefixes, getMediaLibraryAssets } from "@/lib/data/assets";
import { enforceApiGetRateLimit } from "@/lib/server/api-rate-limit";

export async function GET(request: NextRequest): Promise<NextResponse> {
	const rateLimitResponse = await enforceApiGetRateLimit();
	if (rateLimitResponse != null) {
		return rateLimitResponse;
	}

	const { session } = await getCurrentSession();

	if (session == null) {
		return new NextResponse(null, { status: 401 });
	}

	const { searchParams } = request.nextUrl;

	const limit = Math.min(
		Math.max(Number(searchParams.get("limit") ?? mediaLibraryPageSize), 1),
		100,
	);
	const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
	const q = searchParams.get("q") ?? undefined;
	const prefixParam = searchParams.get("prefix");
	const prefix = assetPrefixes.includes(prefixParam as AssetPrefix)
		? (prefixParam as AssetPrefix)
		: undefined;

	const { items, total } = await getMediaLibraryAssets({
		imageUrlOptions: imageGridOptions,
		limit,
		offset,
		prefix,
		q,
	});

	return NextResponse.json({ items, total });
}
