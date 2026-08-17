"use client";

import { articleContributorRolesEnum } from "@dariah-eric/database/schema";
import { type ActionState, createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { AsyncSelect } from "@dariah-eric/ui/async-select";
import { Button } from "@dariah-eric/ui/button";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@dariah-eric/ui/table";
import type { AsyncOptionsFetchPageParams } from "@dariah-eric/ui/use-async-options";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, startTransition, useState, useTransition } from "react";

import {
	FormLayout,
	FormSection,
	FormSectionTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import type { AvailablePerson } from "@/lib/data/article-contributors";
import type { ServerAction } from "@/lib/server/create-server-action";

interface Contributor {
	personId: string;
	personName: string;
	role: string;
}

interface ArticleContributorsSectionProps {
	articleId: string;
	contributors: Array<Contributor>;
	initialPersonItems: Array<AvailablePerson>;
	initialPersonTotal: number;
	createAction: ServerAction;
	deleteAction: (articleId: string, personId: string) => Promise<void>;
}

async function fetchPersonOptionsPage(
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AvailablePerson>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
		resource: "persons",
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	// Contributors are document-level; this endpoint returns person *document* ids.
	const response = await fetch(`/api/contributions/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load persons.");
	}

	return (await response.json()) as { items: Array<AvailablePerson>; total: number };
}

function formatRole(role: string): string {
	return role.charAt(0).toUpperCase() + role.slice(1);
}

export function ArticleContributorsSection(
	props: Readonly<ArticleContributorsSectionProps>,
): ReactNode {
	const {
		articleId,
		contributors,
		initialPersonItems,
		initialPersonTotal,
		createAction,
		deleteAction,
	} = props;

	const t = useExtracted();

	const [localContributors, setLocalContributors] = useState(() => contributors);
	const [selectedPerson, setSelectedPerson] = useState<AvailablePerson | null>(null);
	const [selectedRole, setSelectedRole] = useState<string | null>(null);

	const [state, setState] = useState<ActionState>(() => createActionStateInitial());
	const [isPending, startFormTransition] = useTransition();

	function formAction(formData: FormData) {
		const role = selectedRole;
		const person = selectedPerson;

		startFormTransition(async () => {
			const newState = await createAction(state, formData);
			setState(newState);

			if (newState.status === "success" && person != null && role != null) {
				setLocalContributors((prev) => [
					...prev,
					{ personId: person.id, personName: person.name, role },
				]);
				setSelectedPerson(null);
				setSelectedRole(null);
			}
		});
	}

	return (
		<Fragment>
			<div className="max-inline-3xl space-y-6">
				<div className="space-y-1">
					<FormSectionTitle title={t("Contributors")} />
				</div>

				{localContributors.length > 0 ? (
					<Table aria-label="contributors" className="[--gutter:0] sm:[--gutter:0]">
						<TableHeader>
							<TableColumn isRowHeader={true}>{t("Person")}</TableColumn>
							<TableColumn>{t("Role")}</TableColumn>
							<TableColumn />
						</TableHeader>
						<TableBody items={localContributors}>
							{(contributor) => (
								<TableRow id={contributor.personId}>
									<TableCell>{contributor.personName}</TableCell>
									<TableCell>{formatRole(contributor.role)}</TableCell>
									<TableCell className="text-end">
										<Button
											aria-label={t("Remove contributor")}
											className="block-7 sm:block-7"
											intent="plain"
											onPress={() => {
												startTransition(async () => {
													await deleteAction(articleId, contributor.personId);
													setLocalContributors((prev) =>
														prev.filter((c) => c.personId !== contributor.personId),
													);
												});
											}}
											size="sq-sm"
										>
											<TrashIcon className="block-4 inline-4" />
										</Button>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				) : (
					<p className="text-sm text-neutral-500">{t("No contributors.")}</p>
				)}

				<FormLayout variant="stacked">
					<Form action={formAction} className="flex flex-col gap-y-6" state={state}>
						<FormSection
							description={t("Add a person as a contributor to this article.")}
							title={t("Add contributor")}
							variant="stacked"
						>
							<AsyncSelect
								aria-label={t("Person")}
								emptyMessage={t("No persons found.")}
								fetchPage={fetchPersonOptionsPage}
								initialItems={initialPersonItems}
								initialTotal={initialPersonTotal}
								isRequired={true}
								label={t("Person")}
								onSelect={(item) => {
									setSelectedPerson(item);
								}}
								placeholder={t("No person selected")}
								selectedItem={selectedPerson}
							/>
							<input name="personId" type="hidden" value={selectedPerson?.id ?? ""} />

							<Select
								isRequired={true}
								onChange={(key) => {
									setSelectedRole(String(key));
								}}
								value={selectedRole}
							>
								<Label>{t("Role")}</Label>
								<SelectTrigger />
								<FieldError />
								<SelectContent>
									{articleContributorRolesEnum.map((role) => (
										<SelectItem key={role} id={role}>
											{formatRole(role)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<input name="role" type="hidden" value={selectedRole ?? ""} />

							<input name="articleId" type="hidden" value={articleId} />
						</FormSection>

						<Button className="self-start" isPending={isPending} type="submit">
							{isPending ? (
								<Fragment>
									<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
									<span aria-hidden={true}>{t("Saving...")}</span>
								</Fragment>
							) : (
								t("Add contributor")
							)}
						</Button>

						<FormStatus className="self-start" state={state} />
					</Form>
				</FormLayout>
			</div>
		</Fragment>
	);
}
