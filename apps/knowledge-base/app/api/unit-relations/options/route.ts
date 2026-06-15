import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { getUnitRelationRelatedUnitOptions } from "@/lib/data/unit-relations";
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
	const unitDocumentId = searchParams.get("unitDocumentId");
	const statusId = searchParams.get("statusId");

	if (unitDocumentId == null || statusId == null) {
		return NextResponse.json({ items: [], total: 0 });
	}

	const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 20), 1), 100);
	const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
	const q = searchParams.get("q") ?? undefined;

	const result = await getUnitRelationRelatedUnitOptions({
		limit,
		offset,
		q,
		statusId,
		unitDocumentId,
	});

	return NextResponse.json(result);
}
