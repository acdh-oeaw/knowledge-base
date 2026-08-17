"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import type { ServerAction } from "@/lib/server/create-server-action";

interface AvailablePersonToOrgUnit {
	id: string;
	personName: string;
	orgUnitName: string;
	roleType: string;
}

interface ClaimedContribution {
	id: string;
	personToOrgUnit: {
		id: string;
		person: { name: string };
		organisationalUnit: { name: string };
		roleType: { type: string };
	};
}

interface CountryReportClaimedContributorsFormProps {
	report: {
		id: string;
		contributions: Array<ClaimedContribution>;
	};
	availablePersonToOrgUnits: Array<AvailablePersonToOrgUnit>;
	addAction: ServerAction;
	deleteAction: (formData: FormData) => Promise<void>;
}

function formatRoleType(roleType: string): string {
	return roleType.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function CountryReportClaimedContributorsForm(
	props: Readonly<CountryReportClaimedContributorsFormProps>,
): ReactNode {
	const { report, availablePersonToOrgUnits, addAction, deleteAction } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(addAction, createActionStateInitial());
	const [selectedId, setSelectedId] = useState<string>("");

	const claimedIds = new Set(report.contributions.map((c) => c.personToOrgUnit.id));
	const available = availablePersonToOrgUnits.filter((p) => !claimedIds.has(p.id));

	return (
		<div className="flex flex-col gap-y-8">
			{report.contributions.length > 0 && (
				<section className="flex flex-col gap-y-3">
					<h2 className="text-sm font-semibold text-fg">{t("Contributors")}</h2>
					<ul className="divide-y divide-border rounded-md border">
						{report.contributions.map((contribution) => (
							<li
								key={contribution.id}
								className="flex items-center justify-between gap-x-4 px-4 py-3"
							>
								<div>
									<p className="text-sm font-medium text-fg">
										{contribution.personToOrgUnit.person.name}
									</p>
									<p className="text-xs text-muted-fg">
										{formatRoleType(contribution.personToOrgUnit.roleType.type)}
										{" — "}
										{contribution.personToOrgUnit.organisationalUnit.name}
									</p>
								</div>
								<form action={deleteAction}>
									<input name="contributionId" type="hidden" value={contribution.id} />
									<input name="countryReportId" type="hidden" value={report.id} />
									<Button intent="danger" size="sm" type="submit">
										{t("Remove")}
									</Button>
								</form>
							</li>
						))}
					</ul>
				</section>
			)}

			{available.length > 0 && (
				<section className="flex flex-col gap-y-3">
					<h2 className="text-sm font-semibold text-fg">{t("Add contributor")}</h2>
					<Form action={action} className="flex flex-col gap-y-4 max-inline-sm" state={state}>
						<input name="countryReportId" type="hidden" value={report.id} />

						<Select
							isRequired={true}
							onChange={(key) => {
								setSelectedId(String(key));
							}}
							value={selectedId || null}
						>
							<Label>{t("Person")}</Label>
							<SelectTrigger />
							<FieldError />
							<SelectContent>
								{available.map((p) => (
									<SelectItem key={p.id} id={p.id}>
										{p.personName}
										{" — "}
										{formatRoleType(p.roleType)}
										{" ("}
										{p.orgUnitName}
										{")"}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<input name="personToOrgUnitId" type="hidden" value={selectedId} />

						<Button className="self-start" isPending={isPending} type="submit">
							{isPending ? (
								<Fragment>
									<ProgressCircle aria-label={t("Adding...")} isIndeterminate={true} />
									<span aria-hidden={true}>{t("Adding...")}</span>
								</Fragment>
							) : (
								t("Add")
							)}
						</Button>

						<FormStatus className="self-start" state={state} />
					</Form>
				</section>
			)}

			{report.contributions.length === 0 && available.length === 0 && (
				<p className="text-sm text-muted-fg">{t("No contributors available.")}</p>
			)}
		</div>
	);
}
