import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { contributionOptionsPageSize } from "@/lib/constants/contributions";
import {
	getContributionOrganisationalUnitOptions,
	getContributionPersonOptions,
	getCountryOptions,
} from "@/lib/data/contributions";
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

	const resource = searchParams.get("resource");
	const limit = Math.min(
		Math.max(Number(searchParams.get("limit") ?? contributionOptionsPageSize), 1),
		100,
	);
	const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
	const q = searchParams.get("q") ?? undefined;

	if (resource === "persons") {
		// Draft persons are only offered to users who manage organisational units (admins, working-group
		// chairs, national coordinators), so a coordinator can relate someone they just created.
		let includeDrafts = false;
		if (searchParams.get("includeDrafts") === "true") {
			if (user.role === "admin") {
				includeDrafts = true;
			} else {
				const scopes = await getUserOrganisationalUnitScopes(user);
				includeDrafts = scopes.countries.length > 0 || scopes.workingGroups.length > 0;
			}
		}

		const result = await getContributionPersonOptions({ limit, offset, q, includeDrafts });
		return NextResponse.json(result);
	}

	if (resource === "organisational-units") {
		const roleTypeId = searchParams.get("roleTypeId") ?? undefined;
		const result = await getContributionOrganisationalUnitOptions({
			limit,
			offset,
			q,
			roleTypeId,
		});

		return NextResponse.json(result);
	}

	if (resource === "countries") {
		const result = await getCountryOptions({ limit, offset, q });
		return NextResponse.json(result);
	}

	return NextResponse.json({ items: [], total: 0 });
}
