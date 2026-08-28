"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Badge } from "@dariah-eric/ui/badge";
import { Button } from "@dariah-eric/ui/button";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState } from "react";

import type { WorkingGroupChairRole } from "@/lib/data/working-group-report-chairs";
import { LocaleLink } from "@/lib/navigation/navigation";
import type { ServerAction } from "@/lib/server/create-server-action";

interface SnapshotChair {
	id: string;
	personName: string;
	personSlug: string | null;
	chairRole: WorkingGroupChairRole;
	isCurrent: boolean;
}

interface MissingSnapshotChair {
	personToOrgUnitId: string;
	personName: string;
	personSlug: string;
	chairRole: WorkingGroupChairRole;
}

interface WorkingGroupReportChairsSnapshotFormProps {
	workingGroupReportId: string;
	chairs: Array<SnapshotChair>;
	missing: Array<MissingSnapshotChair>;
	canManageRelations: boolean;
	refreshAction: ServerAction;
}

export function WorkingGroupReportChairsSnapshotForm(
	props: Readonly<WorkingGroupReportChairsSnapshotFormProps>,
): ReactNode {
	const { workingGroupReportId, chairs, missing, canManageRelations, refreshAction } = props;
	const t = useExtracted();
	const [state, action, isPending] = useActionState(refreshAction, createActionStateInitial());
	const hasContent = chairs.length > 0 || missing.length > 0;

	return (
		<section className="flex flex-col gap-y-8">
			<div className="flex flex-col gap-y-2">
				<h2 className="text-sm font-semibold text-fg">{t("Chairs")}</h2>
				<p className="text-sm text-muted-fg max-inline-md">
					{t(
						"Chairs and vice chairs recorded for this report. Edit the relation on the person, then refresh to update this snapshot.",
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

			{chairs.length > 0 && (
				<ul className="divide-y divide-border rounded-md border max-inline-sm">
					{chairs.map((chair) => (
						<li key={chair.id} className="flex items-start justify-between gap-x-4 px-4 py-3">
							<div className="flex flex-col gap-y-1">
								<p className="text-sm font-medium text-fg">{chair.personName}</p>
								<div className="flex flex-wrap items-center gap-2">
									<Badge intent="secondary">
										{chair.chairRole === "is_vice_chair_of" ? t("Vice chair") : t("Chair")}
									</Badge>
									{!chair.isCurrent && (
										<Badge intent="warning">{t("No longer a current chair")}</Badge>
									)}
								</div>
							</div>
							{canManageRelations && chair.personSlug != null && (
								<LocaleLink
									className="shrink-0 text-sm text-fg underline underline-offset-4"
									href={`/dashboard/administrator/persons/${chair.personSlug}/edit`}
								>
									{t("Edit person")}
								</LocaleLink>
							)}
						</li>
					))}
				</ul>
			)}

			{missing.length > 0 && (
				<section className="flex flex-col gap-y-3">
					<h3 className="text-sm font-semibold text-fg">{t("Not yet captured")}</h3>
					<p className="text-sm text-muted-fg max-inline-md">
						{t("These current chairs are not in the report snapshot. Refresh to add them.")}
					</p>
					<ul className="divide-y divide-border rounded-md border max-inline-sm">
						{missing.map((chair) => (
							<li
								key={chair.personToOrgUnitId}
								className="flex items-start justify-between gap-x-4 px-4 py-3"
							>
								<div className="flex flex-col gap-y-1">
									<p className="text-sm font-medium text-fg">{chair.personName}</p>
									<Badge intent="info">
										{chair.chairRole === "is_vice_chair_of" ? t("Vice chair") : t("Chair")}
									</Badge>
								</div>
								{canManageRelations && (
									<LocaleLink
										className="shrink-0 text-sm text-fg underline underline-offset-4"
										href={`/dashboard/administrator/persons/${chair.personSlug}/edit`}
									>
										{t("Edit person")}
									</LocaleLink>
								)}
							</li>
						))}
					</ul>
				</section>
			)}

			{!hasContent && <p className="text-sm text-muted-fg">{t("No chairs recorded.")}</p>}

			<Form action={action} className="flex flex-col gap-y-3 max-inline-sm" state={state}>
				<input name="workingGroupReportId" type="hidden" value={workingGroupReportId} />
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
		</section>
	);
}
