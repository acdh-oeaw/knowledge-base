import * as fs from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { env } from "../config/env.config";

/**
 * One-off post-migration cleanup audit: finds stored relations whose type/type/kind combination is
 * not sanctioned by the allowed-relations vocabulary.
 *
 * The allowed-relations tables are only consulted by the edit UI to decide which relations to
 * offer; they are **not** enforced at the database level (nothing in the relation tables references
 * them, no trigger checks them). So bulk imports and migrations (see `scripts/migrate`) can — and
 * did — write combinations the UI would never produce, e.g. a _country_ recorded as
 * `is_cooperating_partner_of` DARIAH-EU (`migrate-unr.ts` creates this for UNR
 * "cooperating_partnership" countries), while the vocabulary only allows an _institution_ to be a
 * cooperating partner of an eric.
 *
 * Checks both relation tables:
 *
 * - `organisational_units_to_units` vs `organisational_units_allowed_relations` (from-unit subtype,
 *   to-unit subtype, status)
 * - `persons_to_organisational_units` vs `person_role_types_to_organisational_unit_types` (role type,
 *   unit subtype)
 *
 * Read-only; offenders are printed and written to a tsv report so they can be reviewed before any
 * clean-up. Exits with a non-zero exit code when offenders exist, so it can run in ci or a cron
 * job.
 *
 * @example
 * 	pnpm run data:audit:relation-vocabulary
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "relation-vocabulary-findings.tsv");

const db = createDatabaseService({
	connection: {
		database: env.DATABASE_NAME,
		host: env.DATABASE_HOST,
		password: env.DATABASE_PASSWORD,
		port: env.DATABASE_PORT,
		user: env.DATABASE_USER,
	},
	logger: false,
}).unwrap();

type Db = typeof db;

interface VocabularyViolation {
	relationKind: "unit_to_unit" | "person_to_unit";
	relationId: string;
	fromLabel: string;
	fromSlug: string;
	fromType: string;
	toLabel: string;
	toSlug: string;
	toType: string;
	/** The relation kind: an organisational-unit status, or a person role type. */
	relation: string;
}

/** A unit document's subtype is constant across its versions, so this collapses to one row per unit. */
async function getUnitTypeByDocumentId(db: Db): Promise<Map<string, string>> {
	const rows = await db
		.selectDistinct({
			documentId: schema.entityVersions.entityId,
			unitType: schema.organisationalUnitTypes.type,
		})
		.from(schema.entityVersions)
		.innerJoin(
			schema.organisationalUnits,
			eq(schema.organisationalUnits.id, schema.entityVersions.id),
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		);

	return new Map(rows.map((row) => [row.documentId, row.unitType]));
}

/** Sanctioned unit-to-unit combinations as `${fromType}|${toType}|${status}`. */
async function getAllowedUnitRelations(db: Db): Promise<Set<string>> {
	const relatedType = alias(schema.organisationalUnitTypes, "related_unit_type");

	const rows = await db
		.select({
			fromType: schema.organisationalUnitTypes.type,
			toType: relatedType.type,
			status: schema.organisationalUnitStatus.status,
		})
		.from(schema.organisationalUnitsAllowedRelations)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnitsAllowedRelations.unitTypeId),
		)
		.innerJoin(
			relatedType,
			eq(relatedType.id, schema.organisationalUnitsAllowedRelations.relatedUnitTypeId),
		)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(
				schema.organisationalUnitStatus.id,
				schema.organisationalUnitsAllowedRelations.relationTypeId,
			),
		);

	return new Set(rows.map((row) => `${row.fromType}|${row.toType}|${row.status}`));
}

/** Sanctioned person-to-unit combinations as `${roleType}|${unitType}`. */
async function getAllowedPersonRelations(db: Db): Promise<Set<string>> {
	const rows = await db
		.select({
			roleType: schema.personRoleTypes.type,
			unitType: schema.organisationalUnitTypes.type,
		})
		.from(schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations)
		.innerJoin(
			schema.personRoleTypes,
			eq(
				schema.personRoleTypes.id,
				schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.roleTypeId,
			),
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(
				schema.organisationalUnitTypes.id,
				schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.unitTypeId,
			),
		);

	return new Set(rows.map((row) => `${row.roleType}|${row.unitType}`));
}

async function checkUnitRelations(
	db: Db,
	unitTypes: Map<string, string>,
	allowed: Set<string>,
): Promise<Array<VocabularyViolation>> {
	const toEntity = alias(schema.entities, "related_entity");
	const fromSlugs = alias(schema.slugs, "from_slugs");
	const toSlugs = alias(schema.slugs, "to_slugs");

	const rows = await db
		.select({
			relationId: schema.organisationalUnitsRelations.id,
			fromDocumentId: schema.organisationalUnitsRelations.unitDocumentId,
			fromSlug: fromSlugs.value,
			fromLabel: schema.entities.label,
			toDocumentId: schema.organisationalUnitsRelations.relatedUnitDocumentId,
			toSlug: toSlugs.value,
			toLabel: toEntity.label,
			status: schema.organisationalUnitStatus.status,
		})
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.innerJoin(
			schema.entities,
			eq(schema.entities.id, schema.organisationalUnitsRelations.unitDocumentId),
		)
		.innerJoin(
			fromSlugs,
			and(eq(fromSlugs.entityId, schema.entities.id), eq(fromSlugs.isPublished, true)),
		)
		.innerJoin(toEntity, eq(toEntity.id, schema.organisationalUnitsRelations.relatedUnitDocumentId))
		.innerJoin(toSlugs, and(eq(toSlugs.entityId, toEntity.id), eq(toSlugs.isPublished, true)));

	const violations: Array<VocabularyViolation> = [];

	for (const row of rows) {
		const fromType = unitTypes.get(row.fromDocumentId) ?? "(unknown)";
		const toType = unitTypes.get(row.toDocumentId) ?? "(unknown)";

		if (allowed.has(`${fromType}|${toType}|${row.status}`)) {
			continue;
		}

		violations.push({
			relationKind: "unit_to_unit",
			relationId: row.relationId,
			fromLabel: row.fromLabel ?? row.fromDocumentId,
			fromSlug: row.fromSlug,
			fromType,
			toLabel: row.toLabel ?? row.toDocumentId,
			toSlug: row.toSlug,
			toType,
			relation: row.status,
		});
	}

	return violations;
}

async function checkPersonRelations(
	db: Db,
	unitTypes: Map<string, string>,
	allowed: Set<string>,
): Promise<Array<VocabularyViolation>> {
	const unitEntity = alias(schema.entities, "unit_entity");
	const personSlugs = alias(schema.slugs, "person_slugs");
	const unitSlugs = alias(schema.slugs, "unit_slugs");

	const rows = await db
		.select({
			relationId: schema.personsToOrganisationalUnits.id,
			personDocumentId: schema.personsToOrganisationalUnits.personDocumentId,
			personSlug: personSlugs.value,
			personLabel: schema.entities.label,
			unitDocumentId: schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
			unitSlug: unitSlugs.value,
			unitLabel: unitEntity.label,
			roleType: schema.personRoleTypes.type,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		)
		.innerJoin(
			schema.entities,
			eq(schema.entities.id, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(
			personSlugs,
			and(eq(personSlugs.entityId, schema.entities.id), eq(personSlugs.isPublished, true)),
		)
		.innerJoin(
			unitEntity,
			eq(unitEntity.id, schema.personsToOrganisationalUnits.organisationalUnitDocumentId),
		)
		.innerJoin(
			unitSlugs,
			and(eq(unitSlugs.entityId, unitEntity.id), eq(unitSlugs.isPublished, true)),
		);

	const violations: Array<VocabularyViolation> = [];

	for (const row of rows) {
		const unitType = unitTypes.get(row.unitDocumentId) ?? "(unknown)";

		if (allowed.has(`${row.roleType}|${unitType}`)) {
			continue;
		}

		violations.push({
			relationKind: "person_to_unit",
			relationId: row.relationId,
			fromLabel: row.personLabel ?? row.personDocumentId,
			fromSlug: row.personSlug,
			fromType: "person",
			toLabel: row.unitLabel ?? row.unitDocumentId,
			toSlug: row.unitSlug,
			toType: unitType,
			relation: row.roleType,
		});
	}

	return violations;
}

function toTsvCell(value: string): string {
	return value.replaceAll("\t", " ").replaceAll(/\r?\n/g, " ");
}

async function writeReport(violations: Array<VocabularyViolation>): Promise<void> {
	const columns = [
		"relation_kind",
		"relation_id",
		"from_label",
		"from_slug",
		"from_type",
		"relation",
		"to_label",
		"to_slug",
		"to_type",
	] as const;
	const rows = violations.map((violation) =>
		[
			violation.relationKind,
			violation.relationId,
			violation.fromLabel,
			violation.fromSlug,
			violation.fromType,
			violation.relation,
			violation.toLabel,
			violation.toSlug,
			violation.toType,
		]
			.map((value) => toTsvCell(value))
			.join("\t"),
	);

	await fs.mkdir(cacheFolderPath, { recursive: true });
	await fs.writeFile(
		reportFilePath,
		`${columns.join("\t")}\n${rows.join("\n")}${rows.length > 0 ? "\n" : ""}`,
		{ encoding: "utf-8" },
	);
}

async function main(): Promise<void> {
	log.info("Checking stored relations against the allowed-relations vocabulary...");

	const unitTypes = await getUnitTypeByDocumentId(db);
	const [allowedUnit, allowedPerson] = await Promise.all([
		getAllowedUnitRelations(db),
		getAllowedPersonRelations(db),
	]);

	const [unitViolations, personViolations] = await Promise.all([
		checkUnitRelations(db, unitTypes, allowedUnit),
		checkPersonRelations(db, unitTypes, allowedPerson),
	]);

	const violations = [...unitViolations, ...personViolations].toSorted(
		(a, b) =>
			a.relationKind.localeCompare(b.relationKind) ||
			a.relation.localeCompare(b.relation) ||
			a.fromLabel.localeCompare(b.fromLabel),
	);

	for (const violation of violations) {
		log.warn(
			`[${violation.relationKind}] "${violation.fromLabel}" (${violation.fromType}) ` +
				`--${violation.relation}--> "${violation.toLabel}" (${violation.toType}): ` +
				`not in the allowed-relations vocabulary.`,
		);
	}

	await writeReport(violations);

	if (violations.length === 0) {
		log.success("No relations violate the allowed-relations vocabulary.");
		return;
	}

	log.warn(
		`Found ${String(violations.length)} relation(s) outside the allowed-relations vocabulary ` +
			`(${String(unitViolations.length)} unit-to-unit, ${String(personViolations.length)} person-to-unit). ` +
			`Report: ${reportFilePath}`,
	);
	process.exitCode = 1;
}

try {
	await main();
} catch (error) {
	log.error(error);
	process.exitCode = 1;
} finally {
	await db.$client.end().catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	});
}
