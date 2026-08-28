import { asc, eq, inArray } from "drizzle-orm";

import type { Database, Transaction } from "./index";
import type {
	PlaceholderValue,
	PlaceholderValueKind,
	PlaceholderValueListItem,
} from "./placeholder-values";
import * as schema from "./schema";

const statisticsColumnByKind = {
	partner_institutions_count: "partnerInstitutions",
	cooperating_partners_count: "cooperatingPartners",
	working_groups_count: "workingGroups",
} as const satisfies Partial<
	Record<PlaceholderValueKind, keyof typeof schema.statistics.$inferSelect>
>;

type StatisticsBackedKind = keyof typeof statisticsColumnByKind;

function isStatisticsBackedKind(kind: PlaceholderValueKind): kind is StatisticsBackedKind {
	return kind in statisticsColumnByKind;
}

const countryBackedKinds = [
	"member_countries_count",
	"member_countries_list",
	"observer_countries_count",
	"observer_countries_list",
	"member_and_observer_countries_count",
	"member_and_observer_countries_list",
	"cooperating_partner_countries_count",
	"cooperating_partner_countries_list",
] as const satisfies ReadonlyArray<PlaceholderValueKind>;

type CountryBackedKind = (typeof countryBackedKinds)[number];

/**
 * Resolves every country-backed kind from a single `members_and_partners` query, so each count is
 * derived from the same rows as its list and the two can never disagree. The view already restricts
 * to published country versions with an active relation to the published dariah-eu eric.
 */
async function getCountryValues(
	db: Database | Transaction,
): Promise<Record<CountryBackedKind, PlaceholderValue>> {
	// The view's `id` is a published version id; the slug lives on the versioned `slugs` table (the
	// view itself has no slug column despite its drizzle definition declaring one).
	const rows = await db
		.select({
			id: schema.membersAndPartners.id,
			name: schema.membersAndPartners.name,
			slug: schema.slugs.value,
			status: schema.membersAndPartners.status,
		})
		.from(schema.membersAndPartners)
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.membersAndPartners.id))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.where(
			inArray(schema.membersAndPartners.status, [
				"is_member_of",
				"is_observer_of",
				"is_cooperating_partner_of",
			]),
		)
		.orderBy(asc(schema.membersAndPartners.name), asc(schema.membersAndPartners.id));

	const members = rows.filter((row) => row.status === "is_member_of");
	const observers = rows.filter((row) => row.status === "is_observer_of");

	// Merge preserving name order; guard against a country carrying both statuses at once.
	const membersAndObservers = [...members];
	const memberIds = new Set(members.map((row) => row.id));
	for (const row of observers) {
		if (!memberIds.has(row.id)) {
			membersAndObservers.push(row);
		}
	}
	membersAndObservers.sort((a, b) => a.name.localeCompare(b.name, "en"));

	// Cooperating-partner countries are the extra rows the view contributes beyond member/observer
	// countries; exclude the latter so the lists never overlap.
	const memberOrObserverIds = new Set(membersAndObservers.map((row) => row.id));
	const cooperatingPartnerCountries = rows.filter(
		(row) => row.status === "is_cooperating_partner_of" && !memberOrObserverIds.has(row.id),
	);

	function toItems(items: Array<{ name: string; slug: string }>): Array<PlaceholderValueListItem> {
		return items.map((item) => {
			return { name: item.name, slug: item.slug };
		});
	}

	return {
		member_countries_count: members.length,
		member_countries_list: toItems(members),
		observer_countries_count: observers.length,
		observer_countries_list: toItems(observers),
		member_and_observer_countries_count: membersAndObservers.length,
		member_and_observer_countries_list: toItems(membersAndObservers),
		cooperating_partner_countries_count: cooperatingPartnerCountries.length,
		cooperating_partner_countries_list: toItems(cooperatingPartnerCountries),
	};
}

/**
 * Resolves the current data for the requested placeholder-value kinds (see
 * `collectPlaceholderValueKinds` / `annotatePlaceholderValues`): numbers for counts, name arrays
 * for lists — formatting is the renderers' job. Each backing query runs at most once per call,
 * regardless of how many kinds it serves.
 */
export async function getPlaceholderValues(
	db: Database | Transaction,
	kinds: Iterable<PlaceholderValueKind>,
): Promise<Map<PlaceholderValueKind, PlaceholderValue>> {
	const requested = new Set(kinds);
	const values = new Map<PlaceholderValueKind, PlaceholderValue>();

	const statisticsKinds = [...requested].filter((kind): kind is StatisticsBackedKind =>
		isStatisticsBackedKind(kind),
	);
	const countryKinds = countryBackedKinds.filter((kind) => requested.has(kind));

	const [statisticsRow, countryValues] = await Promise.all([
		statisticsKinds.length > 0
			? db
					.select()
					.from(schema.statistics)
					.then((rows) => rows.at(0))
			: undefined,
		countryKinds.length > 0 ? getCountryValues(db) : undefined,
	]);

	for (const kind of statisticsKinds) {
		values.set(kind, statisticsRow?.[statisticsColumnByKind[kind]] ?? 0);
	}

	if (countryValues != null) {
		for (const kind of countryKinds) {
			values.set(kind, countryValues[kind]);
		}
	}

	return values;
}
