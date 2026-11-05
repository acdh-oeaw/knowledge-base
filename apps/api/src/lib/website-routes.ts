import * as schema from "@dariah-eric/database/schema";
import { getEntityHref } from "@dariah-eric/website-routes";

import type { PublicRelatedEntityType } from "@/lib/schemas";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, eq, inArray, sql } from "@/services/db/sql";

type OrganisationalUnitType = (typeof schema.organisationalUnitTypesEnum)[number];

interface WebsiteHrefParams {
	slug: string;
	/** See {@link getConsortiumMemberDocumentIds}. */
	isConsortiumMember?: boolean;
}

/**
 * Adapter between the CMS type vocabulary (`news`, `organisational_units` + subtype) and the
 * website vocabulary spoken by `@dariah-eric/website-routes` (`news-item`, …).
 *
 * Returns null when an entity has no website page to link to, rather than emitting a href that
 * would 404.
 */
export function getWebsiteHref(
	type: PublicRelatedEntityType,
	params: WebsiteHrefParams,
): string | null {
	switch (type) {
		case "events": {
			return getEntityHref({ type: "event", slug: params.slug });
		}
		case "news": {
			return getEntityHref({ type: "news-item", slug: params.slug });
		}
		case "pages": {
			return getEntityHref({ type: "page", slug: params.slug });
		}
		case "projects": {
			return getEntityHref({ type: "project", slug: params.slug });
		}
		case "documents_policies":
		case "funding_calls":
		case "impact_case_studies":
		case "opportunities":
		case "persons":
		case "spotlight_articles": {
			return null;
		}
		case "country":
		case "eric":
		case "governance_body":
		case "institution":
		case "national_consortium":
		case "regional_hub":
		case "working_group": {
			return getOrganisationalUnitHref(type, params);
		}
	}
}

/** As {@link getWebsiteHref}, for the organisational-unit subtypes. */
export function getOrganisationalUnitHref(
	type: OrganisationalUnitType,
	params: WebsiteHrefParams,
): string | null {
	if (type === "institution" && params.isConsortiumMember === true) {
		return getEntityHref({ type: "institution", slug: params.slug });
	}

	return null;
}

/**
 * The institutions with a page on the website, by document id: those with an active `is_member_of`
 * relation to a published national consortium, which is also how `/api/v1/national-consortia` finds
 * a consortium's members. Without `unitDocumentIds`, all of them.
 */
export async function getConsortiumMemberDocumentIds(
	db: Database | Transaction,
	unitDocumentIds?: Array<string>,
): Promise<Set<string>> {
	if (unitDocumentIds?.length === 0) {
		return new Set();
	}

	const consortiumVersions = alias(schema.entityVersions, "consortium_versions");
	const consortiumStatus = alias(schema.entityStatus, "consortium_status");
	const consortia = alias(schema.organisationalUnits, "consortia");
	const consortiumTypes = alias(schema.organisationalUnitTypes, "consortium_types");

	const rows = await db
		.selectDistinct({ unitDocumentId: schema.organisationalUnitsRelations.unitDocumentId })
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			and(
				eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
				eq(schema.organisationalUnitStatus.status, "is_member_of"),
			),
		)
		.innerJoin(
			consortiumVersions,
			eq(consortiumVersions.entityId, schema.organisationalUnitsRelations.relatedUnitDocumentId),
		)
		.innerJoin(
			consortiumStatus,
			and(
				eq(consortiumStatus.id, consortiumVersions.statusId),
				eq(consortiumStatus.type, "published"),
			),
		)
		.innerJoin(consortia, eq(consortia.id, consortiumVersions.id))
		.innerJoin(
			consortiumTypes,
			and(
				eq(consortiumTypes.id, consortia.typeId),
				eq(consortiumTypes.type, "national_consortium"),
			),
		)
		.where(
			and(
				unitDocumentIds != null
					? inArray(schema.organisationalUnitsRelations.unitDocumentId, unitDocumentIds)
					: undefined,
				sql`${schema.organisationalUnitsRelations.duration} @> NOW()::TIMESTAMPTZ`,
			),
		);

	return new Set(rows.map((row) => row.unitDocumentId));
}
