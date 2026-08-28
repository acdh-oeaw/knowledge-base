import { type NextRequest, NextResponse } from "next/server";

import { imageGridOptions } from "@/config/assets.config";
import { getCurrentSession } from "@/lib/auth/session";
import { getAssetByKey } from "@/lib/data/assets";
import { enforceApiGetRateLimit } from "@/lib/server/api-rate-limit";

/**
 * One asset by storage key, for the editor's asset cards. Blocks that keep only the key in the
 * document (richtext `image` and `media_text`) read the asset through here, so the card always
 * shows what the asset says now rather than what it said when the block was authored.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
	const rateLimitResponse = await enforceApiGetRateLimit();
	if (rateLimitResponse != null) {
		return rateLimitResponse;
	}

	const { session } = await getCurrentSession();

	if (session == null) {
		return new NextResponse(null, { status: 401 });
	}

	const key = request.nextUrl.searchParams.get("key");

	if (key == null || key === "") {
		return new NextResponse(null, { status: 400 });
	}

	const asset = await getAssetByKey({ imageUrlOptions: imageGridOptions, key });

	if (asset == null) {
		return new NextResponse(null, { status: 404 });
	}

	return NextResponse.json({ asset });
}
