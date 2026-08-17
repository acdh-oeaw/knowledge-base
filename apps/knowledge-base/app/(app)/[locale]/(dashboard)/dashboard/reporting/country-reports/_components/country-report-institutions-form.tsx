"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Badge } from "@dariah-eric/ui/badge";
import { Button } from "@dariah-eric/ui/button";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState } from "react";

import type { CountryReportInstitutionRepresentation } from "@/lib/data/unit-relations";
import { LocaleLink } from "@/lib/navigation/navigation";
import type { ServerAction } from "@/lib/server/create-server-action";

interface ListedInstitution {
	id: string;
	documentId: string;
	name: string;
	acronym: string | null;
	slug: string | null;
	/** Frozen at capture; null for rows captured before representation type was tracked. */
	representationType: CountryReportInstitutionRepresentation | null;
	/** Whether the institution is still a current partner of the country for the reporting year. */
	isCurrent: boolean;
	/** The institution's current representation, if it is still a partner. */
	currentRepresentationType: CountryReportInstitutionRepresentation | null;
}

interface MissingInstitution {
	institutionDocumentId: string;
	name: string;
	acronym: string | null;
	slug: string;
	representationType: CountryReportInstitutionRepresentation;
}

interface CountryReportInstitutionsFormProps {
	countryReportId: string;
	institutions: Array<ListedInstitution>;
	/** Current partner institutions not (yet) in the frozen snapshot. */
	missing: Array<MissingInstitution>;
	/** Admins get links to the canonical relation editors; coordinators do not (yet) have those. */
	canManageRelations: boolean;
	refreshAction: ServerAction;
}

function useRepresentationLabel(): (
	type: CountryReportInstitutionRepresentation | null,
) => string | null {
	const t = useExtracted();

	return (type) => {
		switch (type) {
			case null: {
				return null;
			}
			case "is_national_coordinating_institution_in": {
				return t("National coordinating institution");
			}
			case "is_national_representative_institution_in": {
				return t("National representative institution");
			}
			case "is_partner_institution_of": {
				return t("Partner institution");
			}
			default: {
				return null;
			}
		}
	};
}

function institutionLabel(name: string, acronym: string | null): string {
	return acronym == null ? name : `${name} (${acronym})`;
}

export function CountryReportInstitutionsForm(
	props: Readonly<CountryReportInstitutionsFormProps>,
): ReactNode {
	const { countryReportId, institutions, missing, canManageRelations, refreshAction } = props;

	const t = useExtracted();
	const representationLabel = useRepresentationLabel();
	const [state, action, isPending] = useActionState(refreshAction, createActionStateInitial());

	const hasContent = institutions.length > 0 || missing.length > 0;

	return (
		<div className="flex flex-col gap-y-8">
			<div className="flex flex-col gap-y-2">
				<h2 className="text-sm font-semibold text-fg">{t("Institutions")}</h2>
				<p className="max-inline-md text-sm text-muted-fg">
					{t(
						"The partner institutions recorded for this report. Edit the underlying relations on the institution itself, then refresh to update this snapshot.",
					)}
				</p>
			</div>

			{institutions.length > 0 && (
				<ul className="divide-y divide-border rounded-md border">
					{institutions.map((institution) => {
						const frozenLabel = representationLabel(institution.representationType);
						const changed =
							institution.isCurrent &&
							institution.currentRepresentationType !== institution.representationType;

						return (
							<li
								key={institution.id}
								className="flex items-start justify-between gap-x-4 px-4 py-3"
							>
								<div className="flex flex-col gap-y-1">
									<p className="text-sm font-medium text-fg">
										{institutionLabel(institution.name, institution.acronym)}
									</p>
									<div className="flex flex-wrap items-center gap-2">
										{frozenLabel != null && <Badge intent="secondary">{frozenLabel}</Badge>}
										{!institution.isCurrent && (
											<Badge intent="warning">{t("No longer a current partner")}</Badge>
										)}
										{changed && (
											<Badge intent="warning">
												{t("Representation changed to {role}", {
													role:
														representationLabel(institution.currentRepresentationType) ?? t("none"),
												})}
											</Badge>
										)}
									</div>
								</div>
								{canManageRelations && institution.slug != null && (
									<LocaleLink
										className="shrink-0 text-sm text-fg underline underline-offset-4"
										href={`/dashboard/administrator/institutions/${institution.slug}/edit`}
									>
										{t("Edit institution")}
									</LocaleLink>
								)}
							</li>
						);
					})}
				</ul>
			)}

			{missing.length > 0 && (
				<section className="flex flex-col gap-y-3">
					<h3 className="text-sm font-semibold text-fg">{t("Not yet captured")}</h3>
					<p className="max-inline-md text-sm text-muted-fg">
						{t(
							"These are current partner institutions of this country that are not in the report snapshot. Refresh to add them.",
						)}
					</p>
					<ul className="divide-y divide-border rounded-md border">
						{missing.map((institution) => (
							<li
								key={institution.institutionDocumentId}
								className="flex items-start justify-between gap-x-4 px-4 py-3"
							>
								<div className="flex flex-col gap-y-1">
									<p className="text-sm font-medium text-fg">
										{institutionLabel(institution.name, institution.acronym)}
									</p>
									<div className="flex flex-wrap items-center gap-2">
										<Badge intent="info">
											{representationLabel(institution.representationType)}
										</Badge>
									</div>
								</div>
								{canManageRelations && (
									<LocaleLink
										className="shrink-0 text-sm text-fg underline underline-offset-4"
										href={`/dashboard/administrator/institutions/${institution.slug}/edit`}
									>
										{t("Edit institution")}
									</LocaleLink>
								)}
							</li>
						))}
					</ul>
				</section>
			)}

			{!hasContent && <p className="text-sm text-muted-fg">{t("No institutions recorded.")}</p>}

			<Form action={action} className="flex flex-col gap-y-3 max-inline-sm" state={state}>
				<input name="countryReportId" type="hidden" value={countryReportId} />
				<Button className="self-start" isPending={isPending} type="submit">
					{isPending ? (
						<Fragment>
							<ProgressCircle aria-label={t("Refreshing...")} isIndeterminate={true} />
							<span aria-hidden={true}>{t("Refreshing...")}</span>
						</Fragment>
					) : (
						t("Refresh from current relations")
					)}
				</Button>
				<FormStatus className="self-start" state={state} />
			</Form>
		</div>
	);
}
