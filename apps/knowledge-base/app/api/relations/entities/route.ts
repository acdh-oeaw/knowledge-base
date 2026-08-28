import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { relationOptionsPageSize } from "@/lib/constants/relations";
import { getEntityRelationOptions, getEntityRelationOptionsByIds } from "@/lib/data/relations";
import { enforceApiGetRateLimit } from "@/lib/server/api-rate-limit";

/** As many ids as the picker will ever look up at once, and a bound on the `IN` list either way. */
const maxIdsPerLookup = 100;

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

	/**
	 * Looking specific entities up by document id, rather than searching for them. Same question as
	 * the search below — "which entities may be linked to" — so it answers in the same shape and from
	 * the same published-only source; a rich-text link that points at an entity holds only its id,
	 * and naming it (in the editor, in a preview) means resolving that id back to a title.
	 *
	 * Unknown, unpublished and deleted ids are simply absent from `items`, which is what tells a
	 * caller the reference no longer resolves.
	 */
	const ids = searchParams.get("ids");
	if (ids != null) {
		const documentIds = ids
			.split(",")
			.map((id) => id.trim())
			.filter((id) => id !== "")
			.slice(0, maxIdsPerLookup);

		const items = await getEntityRelationOptionsByIds(documentIds);

		return NextResponse.json({ items, total: items.length });
	}

	const limit = Math.min(
		Math.max(Number(searchParams.get("limit") ?? relationOptionsPageSize), 1),
		100,
	);
	const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
	const q = searchParams.get("q") ?? undefined;

	const result = await getEntityRelationOptions({ limit, offset, q });

	return NextResponse.json(result);
}
