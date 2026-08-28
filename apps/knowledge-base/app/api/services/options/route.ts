import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { getServiceOptions } from "@/lib/data/services";
import { enforceApiGetRateLimit } from "@/lib/server/api-rate-limit";

/**
 * Service options for the admin maintenance tools. Admin-only, like `/api/maintenance/entities`:
 * this spans every service type and exposes the marketplace id, which the service admin pages are
 * already gated on.
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
	const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 20), 1), 100);
	const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
	const q = searchParams.get("q") ?? undefined;

	const result = await getServiceOptions({ limit, offset, q });

	return NextResponse.json(result);
}
