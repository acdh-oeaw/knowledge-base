export const countryReportInstitutionRepresentationPrecedence = {
	is_national_coordinating_institution_in: 1,
	is_national_representative_institution_in: 2,
	is_partner_institution_of: 3,
} as const;

export type CountryReportInstitutionRepresentation =
	keyof typeof countryReportInstitutionRepresentationPrecedence;

const countryReportInstitutionRepresentationLabels = {
	is_national_coordinating_institution_in: "National coordinating institution",
	is_national_representative_institution_in: "National representative institution",
	is_partner_institution_of: "Partner institution",
} as const satisfies Record<CountryReportInstitutionRepresentation, string>;

/** Human-readable label for an institution's representation type. */
export function formatCountryReportInstitutionRepresentationType(
	type: CountryReportInstitutionRepresentation,
): string {
	return countryReportInstitutionRepresentationLabels[type];
}

export function sortCountryReportInstitutionRepresentationTypes(
	types: Iterable<CountryReportInstitutionRepresentation>,
): Array<CountryReportInstitutionRepresentation> {
	return Array.from(new Set(types)).toSorted(
		(left, right) =>
			countryReportInstitutionRepresentationPrecedence[left] -
			countryReportInstitutionRepresentationPrecedence[right],
	);
}

export interface CountryReportInstitutionSummaryRow {
	id: string;
	organisationalUnitDocumentId: string;
	representationType: CountryReportInstitutionRepresentation | null;
	organisationalUnit: { name: string; acronym: string | null } | null;
}

export interface CountryReportInstitutionSummaryItem {
	id: string;
	name: string;
	acronym: string | null;
	representationTypes: Array<CountryReportInstitutionRepresentation>;
}

export function groupCountryReportInstitutionSummaryRows(
	rows: ReadonlyArray<CountryReportInstitutionSummaryRow>,
): Array<CountryReportInstitutionSummaryItem> {
	const byDocumentId = new Map<string, CountryReportInstitutionSummaryItem>();

	for (const row of rows) {
		const existing = byDocumentId.get(row.organisationalUnitDocumentId);
		if (existing == null) {
			byDocumentId.set(row.organisationalUnitDocumentId, {
				id: row.id,
				name: row.organisationalUnit?.name ?? "",
				acronym: row.organisationalUnit?.acronym ?? null,
				representationTypes:
					row.representationType == null
						? []
						: sortCountryReportInstitutionRepresentationTypes([row.representationType]),
			});
		} else if (row.representationType != null) {
			existing.representationTypes = sortCountryReportInstitutionRepresentationTypes([
				...existing.representationTypes,
				row.representationType,
			]);
		}
	}

	return Array.from(byDocumentId.values()).toSorted((left, right) => {
		const leftTypeOrder =
			countryReportInstitutionRepresentationPrecedence[left.representationTypes[0]!] ??
			Number.MAX_VALUE;
		const rightTypeOrder =
			countryReportInstitutionRepresentationPrecedence[right.representationTypes[0]!] ??
			Number.MAX_VALUE;

		return leftTypeOrder - rightTypeOrder || left.name.localeCompare(right.name);
	});
}
