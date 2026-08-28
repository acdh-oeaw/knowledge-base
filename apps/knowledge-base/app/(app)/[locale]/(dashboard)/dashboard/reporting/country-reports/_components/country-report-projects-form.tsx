"use client";

import type * as schema from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { Input } from "@dariah-eric/ui/input";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { TextField } from "@dariah-eric/ui/text-field";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import { LocaleLink } from "@/lib/navigation/navigation";
import type { ServerAction } from "@/lib/server/create-server-action";

interface Contribution {
	id: string;
	amountEuros: number;
	projectDocumentId: string;
	project: Pick<schema.Project, "name"> | null;
}

interface CountryReportProjectsFormProps {
	report: {
		id: string;
		projectContributions: Array<Contribution>;
	};
	/** `id` is the project document id (entities.id). */
	allProjects: Array<{ id: string; name: string }>;
	/** Admins get a link to the projects overview; coordinators do not (yet) have those screens. */
	canManageRelations: boolean;
	addAction: ServerAction;
	deleteAction: (formData: FormData) => Promise<void>;
}

export function CountryReportProjectsForm(
	props: Readonly<CountryReportProjectsFormProps>,
): ReactNode {
	const { report, allProjects, canManageRelations, addAction, deleteAction } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(addAction, createActionStateInitial());
	const [selectedProjectId, setSelectedProjectId] = useState<string>("");

	const existingProjectIds = new Set(report.projectContributions.map((c) => c.projectDocumentId));
	const availableProjects = allProjects.filter((p) => !existingProjectIds.has(p.id));

	return (
		<div className="flex flex-col gap-y-8">
			{canManageRelations && (
				<LocaleLink
					className="self-start text-sm text-fg underline underline-offset-4"
					href="/dashboard/administrator/projects"
				>
					{t("Manage projects")}
				</LocaleLink>
			)}

			{report.projectContributions.length > 0 && (
				<section className="flex flex-col gap-y-3">
					<h2 className="text-sm font-semibold text-fg">{t("Project contributions")}</h2>
					<ul className="divide-y divide-border rounded-md border">
						{report.projectContributions.map((contribution) => (
							<li
								key={contribution.id}
								className="flex items-center justify-between gap-x-4 px-4 py-3"
							>
								<div>
									<p className="text-sm font-medium text-fg">{contribution.project?.name ?? ""}</p>
									<p className="text-xs text-muted-fg">
										{t("Total funding amount (EUR)")}: {contribution.amountEuros.toLocaleString()}
									</p>
								</div>
								<form action={deleteAction}>
									<input name="contributionId" type="hidden" value={contribution.id} />
									<input name="countryReportId" type="hidden" value={report.id} />
									<Button
										className="text-danger hover:bg-danger/10 hover:text-danger"
										intent="plain"
										size="sm"
										type="submit"
									>
										{t("Remove")}
									</Button>
								</form>
							</li>
						))}
					</ul>
				</section>
			)}

			{availableProjects.length > 0 && (
				<section className="flex flex-col gap-y-3">
					<h2 className="text-sm font-semibold text-fg">{t("Add project contribution")}</h2>
					<Form action={action} className="flex flex-col gap-y-4 max-inline-sm" state={state}>
						<input name="countryReportId" type="hidden" value={report.id} />

						<Select
							isRequired={true}
							onChange={(key) => {
								setSelectedProjectId(String(key));
							}}
							value={selectedProjectId || null}
						>
							<Label>{t("Project")}</Label>
							<SelectTrigger />
							<FieldError />
							<SelectContent>
								{availableProjects.map((project) => (
									<SelectItem key={project.id} id={project.id}>
										{project.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<input name="projectDocumentId" type="hidden" value={selectedProjectId} />

						<TextField isRequired={true} name="amountEuros" type="number">
							<Label>{t("Total funding amount (EUR)")}</Label>
							<Input min={0} step="0.01" />
							<FieldError />
						</TextField>

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

			{report.projectContributions.length === 0 && availableProjects.length === 0 && (
				<p className="text-sm text-muted-fg">{t("No projects available.")}</p>
			)}
		</div>
	);
}
