import * as schema from "@dariah-eric/database/schema";
import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { publishedEntityVersionWhere } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { matchesAllTerms } from "@/lib/db/search";
import { type SQL, and, count, eq, inArray } from "@/lib/db/sql";
import { enforceApiGetRateLimit } from "@/lib/server/api-rate-limit";

const defaultLimit = 20;
const allowedTypes = [
	"events",
	"news",
	"opportunities",
	"funding_calls",
	"pages",
	"spotlight_articles",
	"impact_case_studies",
] as const;

type ContentBlockEntryType = (typeof allowedTypes)[number];

function isContentBlockEntryType(value: string | null): value is ContentBlockEntryType {
	return value != null && allowedTypes.includes(value as ContentBlockEntryType);
}

function createWhere(
	title: Parameters<typeof matchesAllTerms>[1],
	id: Parameters<typeof inArray>[0],
	q: string | undefined,
	ids: Array<string> | undefined,
): SQL | undefined {
	const searchWhere = matchesAllTerms(q, title);
	const entryWhere = searchWhere ?? (ids != null ? inArray(id, ids) : undefined);

	return and(publishedEntityVersionWhere(), entryWhere);
}

async function getEntries(
	table: typeof schema.events,
	limit: number,
	offset: number,
	q: string | undefined,
	ids: Array<string> | undefined,
) {
	const where = createWhere(table.title, table.id, q, ids);
	const [items, aggregate] = await Promise.all([
		db
			.select({ id: table.id, title: table.title })
			.from(table)
			.innerJoin(schema.entityVersions, eq(table.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(where)
			.orderBy(table.title)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(table)
			.innerJoin(schema.entityVersions, eq(table.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(where),
	]);

	return { items, total: aggregate.at(0)?.total ?? 0 };
}

function asEntryTable(table: unknown): typeof schema.events {
	return table as typeof schema.events;
}

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

	const type = searchParams.get("type");
	if (!isContentBlockEntryType(type)) {
		return NextResponse.json({ items: [], total: 0 });
	}

	const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? defaultLimit), 1), 100);
	const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
	const q = searchParams.get("q") ?? undefined;
	const idsParam = searchParams.get("ids");
	const ids =
		idsParam != null && idsParam.trim() !== "" ? idsParam.split(",").filter(Boolean) : undefined;

	if (type === "events") {
		return NextResponse.json(await getEntries(schema.events, limit, offset, q, ids));
	}

	if (type === "news") {
		return NextResponse.json(await getEntries(asEntryTable(schema.news), limit, offset, q, ids));
	}

	if (type === "opportunities") {
		return NextResponse.json(
			await getEntries(asEntryTable(schema.opportunities), limit, offset, q, ids),
		);
	}

	if (type === "pages") {
		return NextResponse.json(await getEntries(asEntryTable(schema.pages), limit, offset, q, ids));
	}

	if (type === "spotlight_articles") {
		return NextResponse.json(
			await getEntries(asEntryTable(schema.spotlightArticles), limit, offset, q, ids),
		);
	}

	if (type === "impact_case_studies") {
		return NextResponse.json(
			await getEntries(asEntryTable(schema.impactCaseStudies), limit, offset, q, ids),
		);
	}

	return NextResponse.json(
		await getEntries(asEntryTable(schema.fundingCalls), limit, offset, q, ids),
	);
}
