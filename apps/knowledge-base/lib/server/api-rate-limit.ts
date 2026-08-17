import { globalGetRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { NextResponse } from "next/server";

export async function enforceApiGetRateLimit(): Promise<NextResponse | null> {
	if (await globalGetRequestRateLimit()) {
		return null;
	}

	return NextResponse.json({ message: "Too many requests." }, { status: 429 });
}
