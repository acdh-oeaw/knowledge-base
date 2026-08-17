import { organisationalUnitTypesEnum } from "@dariah-eric/database/schema";
import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import {
	type OrganisationalUnitType,
	getOrganisationalUnitOptions,
} from "@/lib/data/organisational-units";
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
	const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 20), 1), 100);
	const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
	const q = searchParams.get("q") ?? undefined;
	const unitTypeParam = searchParams.get("unitType");
	const unitType = (organisationalUnitTypesEnum as ReadonlyArray<string>).includes(
		unitTypeParam ?? "",
	)
		? (unitTypeParam as OrganisationalUnitType)
		: undefined;
	const locatedInCountryDocumentId = searchParams.get("locatedInCountryDocumentId") ?? undefined;

	const result = await getOrganisationalUnitOptions({
		limit,
		offset,
		q,
		unitType,
		locatedInCountryDocumentId,
	});

	return NextResponse.json(result);
}
