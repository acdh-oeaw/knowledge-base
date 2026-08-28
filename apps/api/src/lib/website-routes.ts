import * as schema from "@dariah-eric/database/schema";
import { getEntityHref, resolveInterimPagePath } from "@dariah-eric/website-routes";

import type { PublicRelatedEntityType } from "@/lib/schemas";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, eq, inArray, sql } from "@/services/db/sql";

type OrganisationalUnitType = (typeof schema.organisationalUnitTypesEnum)[number];

/**
 * Adapter between the CMS type vocabulary (`news`, `organisational_units` + subtype) and the
 * website vocabulary spoken by `@dariah-eric/website-routes` (`news-item`, `country`, …).
 *
 * Returns null when an entity has no website page to link to (rather than emitting a href that
 * would 404 or navigate without informing): institutions and national consortia live on their
 * country's page, so they need {@link getCountrySlugsByOrganisationalUnitDocumentId}; a page's real
 * pathname is not stored in the CMS yet; and the ERIC itself has no page.
 */
export function getWebsiteHref(
	type: PublicRelatedEntityType,
	params: { slug: string; countrySlug?: string | null },
): string | null {
	switch (type) {
		case "documents_policies": {
			return getEntityHref({ type: "document-or-policy" });
		}
		case "events": {
			return getEntityHref({ type: "event", slug: params.slug });
		}
		case "funding_calls": {
			return getEntityHref({ type: "funding-call", slug: params.slug });
		}
		case "impact_case_studies": {
			return getEntityHref({ type: "impact-case-study", slug: params.slug });
		}
		case "news": {
			return getEntityHref({ type: "news-item", slug: params.slug });
		}
		case "opportunities": {
			return getEntityHref({ type: "opportunity", slug: params.slug });
		}
		case "pages": {
			// Interim: a page's real pathname is not yet stored in the CMS, so it is resolved through a
			// hardcoded slug→path map; unmapped pages get no href instead of a 404 link. Remove once
			// pages own a `path` column (docs/website-url-resolution.md).
			const path = resolveInterimPagePath(params.slug);
			return path != null ? getEntityHref({ type: "page", path }) : null;
		}
		case "persons": {
			return getEntityHref({ type: "person", slug: params.slug });
		}
		case "projects": {
			return getEntityHref({ type: "project", slug: params.slug });
		}
		case "spotlight_articles": {
			return getEntityHref({ type: "spotlight-article", slug: params.slug });
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
	params: { slug: string; countrySlug?: string | null },
): string | null {
	switch (type) {
		case "country": {
			return getEntityHref({ type: "country", slug: params.slug });
		}
		case "eric": {
			// DARIAH-EU itself is the whole site, not an entity page — better plain text than a link to
			// the homepage.
			return null;
		}
		case "governance_body": {
			return getEntityHref({ type: "governance-body", slug: params.slug });
		}
		case "regional_hub": {
			return getEntityHref({ type: "regional-hub" });
		}
		case "working_group": {
			return getEntityHref({ type: "working-group", slug: params.slug });
		}
		case "institution":
		case "national_consortium": {
			if (params.countrySlug == null) {
				return null;
			}
			return getEntityHref({
				type: type === "institution" ? "institution" : "national-consortium",
				countrySlug: params.countrySlug,
			});
		}
	}
}

/**
 * Relations that put a unit on a country's members-and-partners page: `is_located_in` for
 * institutions, `is_national_consortium_of` for national consortia.
 */
const countryRelationStatus = [
	"is_located_in",
	"is_national_consortium_of",
] as const satisfies ReadonlyArray<(typeof schema.organisationalUnitStatusEnum)[number]>;

/**
 * The country slug an institution or national consortium is surfaced under, keyed by unit document
 * id. Institutions reach their country indirectly via `is_located_in` (their DARIAH-EU statuses
 * point at the ERIC, not at a country); consortia via `is_national_consortium_of`. Only currently
 * valid relations count, and only countries that actually have a members-and-partners page.
 */
export async function getCountrySlugsByOrganisationalUnitDocumentId(
	db: Database | Transaction,
	unitDocumentIds: Array<string>,
): Promise<Map<string, string>> {
	const countrySlugs = new Map<string, string>();

	if (unitDocumentIds.length === 0) {
		return countrySlugs;
	}

	const countryEntities = alias(schema.entities, "country_entities");
	const countryEntityVersions = alias(schema.entityVersions, "country_entity_versions");
	const countrySlugsAlias = alias(schema.slugs, "country_slugs");

	const rows = await db
		.select({
			unitDocumentId: schema.organisationalUnitsRelations.unitDocumentId,
			countrySlug: countrySlugsAlias.value,
		})
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.innerJoin(
			countryEntities,
			eq(countryEntities.id, schema.organisationalUnitsRelations.relatedUnitDocumentId),
		)
		.innerJoin(countryEntityVersions, eq(countryEntityVersions.entityId, countryEntities.id))
		// The view holds published member/observer/cooperating-partner countries, i.e. exactly those
		// with a page on the website.
		.innerJoin(
			schema.membersAndPartners,
			eq(schema.membersAndPartners.id, countryEntityVersions.id),
		)
		.innerJoin(countrySlugsAlias, eq(countrySlugsAlias.entityVersionId, countryEntityVersions.id))
		.where(
			and(
				inArray(schema.organisationalUnitsRelations.unitDocumentId, unitDocumentIds),
				inArray(schema.organisationalUnitStatus.status, countryRelationStatus),
				sql`${schema.organisationalUnitsRelations.duration} @> NOW()::TIMESTAMPTZ`,
			),
		);

	for (const row of rows) {
		countrySlugs.set(row.unitDocumentId, row.countrySlug);
	}

	return countrySlugs;
}
