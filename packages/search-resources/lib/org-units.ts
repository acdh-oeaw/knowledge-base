import type { Database } from "@acdh-knowledge-base/database";
import * as schema from "@acdh-knowledge-base/database/schema";
import { and, eq, sql } from "@acdh-knowledge-base/database/sql";

import type { OrgUnitResourceLookups } from "./resources";

function addToMapSet<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
	let set = map.get(key);
	if (set == null) {
		set = new Set();
		map.set(key, set);
	}
	set.add(value);
}

/**
 * Build the lookups needed to resolve sshoc actor ids and zotero collection names to the slugs of
 * the national consortia, working groups, and institutions that own a resource. Reads from the
 * database the set of national consortia, working groups, institutions, and countries that have a
 * published version, plus the currently-active `is_national_consortium_of` relations.
 */
export async function loadOrgUnitLookups(db: Database): Promise<OrgUnitResourceLookups> {
	// Unit↔unit relations are document-level; key org units by their document id (published version).
	const orgUnits = await db
		.select({
			acronym: schema.organisationalUnits.acronym,
			id: schema.entities.id,
			slug: schema.entities.slug,
			type: schema.organisationalUnitTypes.type,
			sshocMarketplaceActorId: schema.organisationalUnits.sshocMarketplaceActorId,
		})
		.from(schema.organisationalUnits)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
		)
		.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
		.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.entities.id),
		)
		.where(eq(schema.organisationalUnits.id, schema.documentLifecycle.publishedId));

	const sshocActorIdToNc = new Map<number, Set<string>>();
	const sshocActorIdToWg = new Map<number, Set<string>>();
	const sshocActorIdToInstitution = new Map<number, Set<string>>();
	const wgSlugs = new Set<string>();
	const ncIdToSlug = new Map<string, string>();
	const countryIdToSlug = new Map<string, string>();

	for (const unit of orgUnits) {
		if (unit.type === "national_consortium") {
			ncIdToSlug.set(unit.id, unit.slug);
			if (unit.sshocMarketplaceActorId != null) {
				addToMapSet(sshocActorIdToNc, unit.sshocMarketplaceActorId, unit.slug);
			}
		} else if (unit.type === "working_group") {
			wgSlugs.add(unit.slug.toLowerCase());
			if (unit.sshocMarketplaceActorId != null) {
				addToMapSet(sshocActorIdToWg, unit.sshocMarketplaceActorId, unit.slug);
			}
		} else if (unit.type === "institution") {
			if (unit.sshocMarketplaceActorId != null) {
				addToMapSet(sshocActorIdToInstitution, unit.sshocMarketplaceActorId, unit.slug);
			}
		} else if (unit.type === "country") {
			countryIdToSlug.set(unit.id, unit.acronym ?? unit.slug);
		}
	}

	const relations = await db
		.select({
			ncId: schema.organisationalUnitsRelations.unitDocumentId,
			countryId: schema.organisationalUnitsRelations.relatedUnitDocumentId,
		})
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.where(
			and(
				eq(schema.organisationalUnitStatus.status, "is_national_consortium_of"),
				sql`${schema.organisationalUnitsRelations.duration} @> NOW()::TIMESTAMPTZ`,
			),
		);

	const countrySlugToNc = new Map<string, Set<string>>();

	for (const relation of relations) {
		const ncSlug = ncIdToSlug.get(relation.ncId);
		const countrySlug = countryIdToSlug.get(relation.countryId);
		if (ncSlug == null || countrySlug == null) {
			continue;
		}
		addToMapSet(countrySlugToNc, countrySlug.toLowerCase(), ncSlug);
	}

	return {
		sshocActorIdToNc,
		sshocActorIdToWg,
		sshocActorIdToInstitution,
		countrySlugToNc,
		wgSlugs,
	};
}
