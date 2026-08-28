"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Badge } from "@dariah-eric/ui/badge";
import { Button } from "@dariah-eric/ui/button";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState } from "react";

import { getCompensationRoleLabel } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/contribution-role-labels";
import type { CompensationRole } from "@/lib/data/report-contributions";
import { LocaleLink } from "@/lib/navigation/navigation";
import type { ServerAction } from "@/lib/server/create-server-action";

interface SnapshotContributor {
	id: string;
	personName: string;
	personSlug: string | null;
	compensationRole: CompensationRole | null;
	isCurrent: boolean;
}

interface MissingSnapshotContributor {
	personToOrgUnitId: string;
	personName: string;
	personSlug: string;
	compensationRole: CompensationRole;
}

interface CountryReportContributorsSnapshotFormProps {
	countryReportId: string;
	contributors: Array<SnapshotContributor>;
	missing: Array<MissingSnapshotContributor>;
	canManageRelations: boolean;
	refreshAction: ServerAction;
}

export function CountryReportContributorsSnapshotForm(
	props: Readonly<CountryReportContributorsSnapshotFormProps>,
): ReactNode {
	const { countryReportId, contributors, missing, canManageRelations, refreshAction } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(refreshAction, createActionStateInitial());

	const hasContent = contributors.length > 0 || missing.length > 0;

	return (
		<div className="flex flex-col gap-y-8">
			<div className="flex flex-col gap-y-2">
				<h2 className="text-sm font-semibold text-fg">{t("National coordinators")}</h2>
				<p className="text-sm text-muted-fg max-inline-md">
					{t(
						"Coordinators and deputies recorded for this report. Edit the role on the person itself, then refresh to update this snapshot.",
					)}
				</p>
				{canManageRelations && (
					<LocaleLink
						className="self-start text-sm text-fg underline underline-offset-4"
						href="/dashboard/administrator/persons"
					>
						{t("Manage persons")}
					</LocaleLink>
				)}
			</div>

			{contributors.length > 0 && (
				<ul className="divide-y divide-border rounded-md border">
					{contributors.map((contributor) => {
						const roleLabel = getCompensationRoleLabel(t, contributor.compensationRole);

						return (
							<li
								key={contributor.id}
								className="flex items-start justify-between gap-x-4 px-4 py-3"
							>
								<div className="flex flex-col gap-y-1">
									<p className="text-sm font-medium text-fg">{contributor.personName}</p>
									<div className="flex flex-wrap items-center gap-2">
										{roleLabel != null && <Badge intent="secondary">{roleLabel}</Badge>}
										{!contributor.isCurrent && (
											<Badge intent="warning">{t("No longer a current coordinator")}</Badge>
										)}
									</div>
								</div>
								{canManageRelations && contributor.personSlug != null && (
									<LocaleLink
										className="shrink-0 text-sm text-fg underline underline-offset-4"
										href={`/dashboard/administrator/persons/${contributor.personSlug}/edit`}
									>
										{t("Edit person")}
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
					<p className="text-sm text-muted-fg max-inline-md">
						{t(
							"These coordinators/deputies are current for this country but not in the report snapshot. Refresh to add them.",
						)}
					</p>
					<ul className="divide-y divide-border rounded-md border">
						{missing.map((contributor) => (
							<li
								key={contributor.personToOrgUnitId}
								className="flex items-start justify-between gap-x-4 px-4 py-3"
							>
								<div className="flex flex-col gap-y-1">
									<p className="text-sm font-medium text-fg">{contributor.personName}</p>
									<div className="flex flex-wrap items-center gap-2">
										<Badge intent="info">
											{getCompensationRoleLabel(t, contributor.compensationRole)}
										</Badge>
									</div>
								</div>
								{canManageRelations && (
									<LocaleLink
										className="shrink-0 text-sm text-fg underline underline-offset-4"
										href={`/dashboard/administrator/persons/${contributor.personSlug}/edit`}
									>
										{t("Edit person")}
									</LocaleLink>
								)}
							</li>
						))}
					</ul>
				</section>
			)}

			{!hasContent && (
				<p className="text-sm text-muted-fg">{t("No coordinator contributors recorded.")}</p>
			)}

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
