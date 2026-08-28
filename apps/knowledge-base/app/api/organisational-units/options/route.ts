import { organisationalUnitTypesEnum } from "@dariah-eric/database/schema";
import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import {
	type OrganisationalUnitType,
	getOrganisationalUnitOptions,
} from "@/lib/data/organisational-units";
import { getUserOrganisationalUnitScopes } from "@/lib/data/user-organisational-units";
import { enforceApiGetRateLimit } from "@/lib/server/api-rate-limit";

export async function GET(request: NextRequest): Promise<NextResponse> {
	const rateLimitResponse = await enforceApiGetRateLimit();
	if (rateLimitResponse != null) {
		return rateLimitResponse;
	}

	const { session, user } = await getCurrentSession();

	if (session == null || user == null) {
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

	// Draft units are only offered to users who manage organisational units (admins, working-group
	// chairs, national coordinators), so a coordinator can relate one they just created.
	let includeDrafts = false;
	if (searchParams.get("includeDrafts") === "true") {
		if (user.role === "admin") {
			includeDrafts = true;
		} else {
			const scopes = await getUserOrganisationalUnitScopes(user);
			includeDrafts = scopes.countries.length > 0 || scopes.workingGroups.length > 0;
		}
	}

	const result = await getOrganisationalUnitOptions({
		limit,
		offset,
		q,
		unitType,
		locatedInCountryDocumentId,
		includeDrafts,
	});

	return NextResponse.json(result);
}
