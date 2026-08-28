import { type NextRequest, NextResponse } from "next/server";
import * as v from "valibot";

import { env } from "@/config/env.config";
import {
	getSyncableWebsiteEntityIdsByType,
	supportedWebsiteEntityTypes,
	syncWebsiteDocumentForEntityWithResult,
} from "@/lib/search/website-index";

const SyncWebsiteSearchIndexRequestSchema = v.union([
	v.object({
		entityId: v.pipe(v.string(), v.uuid()),
	}),
	v.object({
		entityIds: v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.minLength(1)),
	}),
	v.object({
		mode: v.literal("all"),
	}),
	v.object({
		mode: v.literal("type"),
		entityType: v.picklist(supportedWebsiteEntityTypes),
	}),
]);

function isAuthorized(request: NextRequest): boolean {
	if (env.SEARCH_SYNC_API_SECRET == null) {
		return false;
	}

	const authorization = request.headers.get("authorization");

	return authorization === `Bearer ${env.SEARCH_SYNC_API_SECRET}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
	if (!isAuthorized(request)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const result = await v.safeParseAsync(SyncWebsiteSearchIndexRequestSchema, body);

	if (!result.success) {
		return NextResponse.json(
			{ error: "Invalid request body", issues: v.flatten(result.issues) },
			{ status: 400 },
		);
	}

	const entityIds =
		"mode" in result.output
			? result.output.mode === "all"
				? await getSyncableWebsiteEntityIdsByType()
				: await getSyncableWebsiteEntityIdsByType(result.output.entityType)
			: "entityId" in result.output
				? [result.output.entityId]
				: [...result.output.entityIds];

	const items = await Promise.all(
		entityIds.map(async (entityId) => syncWebsiteDocumentForEntityWithResult(entityId)),
	);

	const ok = items.every((item) => item.ok);

	return NextResponse.json(
		{
			count: items.length,
			ok,
			items,
		},
		{ status: ok ? 200 : 207 },
	);
}
