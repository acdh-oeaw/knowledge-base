import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { relationOptionsPageSize } from "@/lib/constants/relations";
import { getMaintenanceEntityOptions } from "@/lib/data/maintenance-entity-options";
import { enforceApiGetRateLimit } from "@/lib/server/api-rate-limit";

/**
 * Entity options for the admin maintenance tools. Unlike `/api/relations/entities` this exposes
 * never-published drafts, so it is admin-only rather than merely authenticated.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

	const { searchParams } = request.nextUrl;
	const limit = Math.min(
		Math.max(Number(searchParams.get("limit") ?? relationOptionsPageSize), 1),
		100,
	);
	const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
	const q = searchParams.get("q") ?? undefined;

	const result = await getMaintenanceEntityOptions({ limit, offset, q });

	return NextResponse.json(result);
}
