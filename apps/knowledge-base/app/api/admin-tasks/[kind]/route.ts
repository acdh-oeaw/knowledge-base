import { backgroundJobKindEnum } from "@dariah-eric/database/schema";
import { type NextRequest, NextResponse } from "next/server";
import * as v from "valibot";

import { env } from "@/config/env.config";
import { startAdminTask } from "@/lib/admin-tasks/start-admin-task";

const AdminTaskKindSchema = v.picklist(backgroundJobKindEnum);

function isAuthorized(request: NextRequest): boolean {
	if (env.BACKGROUND_JOBS_API_SECRET == null) {
		return false;
	}

	const authorization = request.headers.get("authorization");

	return authorization === `Bearer ${env.BACKGROUND_JOBS_API_SECRET}`;
}

/**
 * Starts an admin task as a background job, for the scheduled workflow in
 * `.github/workflows/scheduled-sync.yaml`. Responds once the job has started, not when it has
 * finished — the outcome is recorded in `background_jobs` and shown on the admin tasks page.
 *
 * Like every non-GET route handler, requests must send an `Origin` header matching the host (see
 * `csrf.middleware.ts`).
 */
export async function POST(
	request: NextRequest,
	{ params }: RouteContext<"/api/admin-tasks/[kind]">,
): Promise<NextResponse> {
	if (!isAuthorized(request)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const result = v.safeParse(AdminTaskKindSchema, (await params).kind);

	if (!result.success) {
		return NextResponse.json({ error: "Unknown admin task" }, { status: 404 });
	}

	const outcome = await startAdminTask(result.output, null);

	if (outcome.status === "already_running") {
		return NextResponse.json({ status: outcome.status }, { status: 409 });
	}

	return NextResponse.json(outcome, { status: 202 });
}
