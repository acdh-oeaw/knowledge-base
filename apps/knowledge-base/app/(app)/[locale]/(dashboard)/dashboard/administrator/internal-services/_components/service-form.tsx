"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { AsyncMultipleSelect } from "@acdh-knowledge-base/ui/async-multiple-select";
import { Button } from "@acdh-knowledge-base/ui/button";
import { Checkbox } from "@acdh-knowledge-base/ui/checkbox";
import { FieldError, Label } from "@acdh-knowledge-base/ui/field";
import { Form } from "@acdh-knowledge-base/ui/form";
import { FormStatus } from "@acdh-knowledge-base/ui/form-status";
import { Input } from "@acdh-knowledge-base/ui/input";
import { ProgressCircle } from "@acdh-knowledge-base/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@acdh-knowledge-base/ui/select";
import { Separator } from "@acdh-knowledge-base/ui/separator";
import { TextField } from "@acdh-knowledge-base/ui/text-field";
import { TextArea } from "@acdh-knowledge-base/ui/textarea";
import type {
	AsyncOption,
	AsyncOptionsFetchPageParams,
} from "@acdh-knowledge-base/ui/use-async-options";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import {
	type OrganisationalUnitOption,
	toOrganisationalUnitDocumentOptionsPage,
} from "@/lib/organisational-unit-options";
import type { ServerAction } from "@/lib/server/create-server-action";

interface ServiceFormProps {
	service?: Pick<
		schema.Service,
		"id" | "name" | "statusId" | "comment" | "dariahBranding" | "monitoring" | "privateSupplier"
	> & {
		ownerUnitDocumentIds: Array<string>;
		providerUnitDocumentIds: Array<string>;
	};
	serviceStatuses: Array<Pick<schema.ServiceStatus, "id" | "status">>;
	initialOrganisationalUnitItems: Array<AsyncOption>;
	initialOrganisationalUnitTotal: number;
	selectedOrganisationalUnits?: Array<AsyncOption>;
	formAction: ServerAction;
}

async function fetchOrganisationalUnitOptionsPage(
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/organisational-units/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load organisational units.");
	}

	return toOrganisationalUnitDocumentOptionsPage(
		(await response.json()) as { items: Array<OrganisationalUnitOption>; total: number },
	);
}

function formatServiceStatus(status: string): string {
	return status.replaceAll("_", " ").replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

export function ServiceForm(props: Readonly<ServiceFormProps>): ReactNode {
	const {
		service,
		serviceStatuses,
		initialOrganisationalUnitItems,
		initialOrganisationalUnitTotal,
		selectedOrganisationalUnits,
		formAction,
	} = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const [selectedStatusId, setSelectedStatusId] = useState<string>(service?.statusId ?? "");
	const [selectedOwnerUnitDocumentIds, setSelectedOwnerUnitDocumentIds] = useState<Array<string>>(
		service?.ownerUnitDocumentIds ?? [],
	);
	const [selectedProviderUnitDocumentIds, setSelectedProviderUnitDocumentIds] = useState<
		Array<string>
	>(service?.providerUnitDocumentIds ?? []);

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection description={t("Enter the service details.")} title={t("Details")}>
					<TextField defaultValue={service?.name} isRequired={true} name="name">
						<Label>{t("Name")}</Label>
						<Input />
						<FieldError />
					</TextField>
					<Select
						isRequired={true}
						onChange={(key) => {
							setSelectedStatusId(String(key));
						}}
						value={selectedStatusId || null}
					>
						<Label>{t("Status")}</Label>
						<SelectTrigger />
						<FieldError />
						<SelectContent>
							{serviceStatuses.map((status) => (
								<SelectItem key={status.id} id={status.id}>
									{formatServiceStatus(status.status)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<input name="statusId" type="hidden" value={selectedStatusId} />

					<TextField defaultValue={service?.comment ?? undefined} name="comment">
						<Label>{t("Comment")}</Label>
						<TextArea rows={5} />
						<FieldError />
					</TextField>
				</FormSection>

				<Separator className="my-6" />

				<FormSection description={t("Configure service flags.")} title={t("Flags")}>
					<Checkbox
						defaultSelected={service?.dariahBranding ?? false}
						name="dariahBranding"
						value="true"
					>
						{t("DARIAH branding")}
					</Checkbox>

					<Checkbox defaultSelected={service?.monitoring ?? false} name="monitoring" value="true">
						{t("Monitoring")}
					</Checkbox>

					<Checkbox
						defaultSelected={service?.privateSupplier ?? false}
						name="privateSupplier"
						value="true"
					>
						{t("Private supplier")}
					</Checkbox>
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t("Link organisational units as service owners or providers.")}
					title={t("Organisational units")}
				>
					<AsyncMultipleSelect
						aria-label={t("Service owners")}
						fetchPage={fetchOrganisationalUnitOptionsPage}
						initialItems={initialOrganisationalUnitItems}
						initialTotal={initialOrganisationalUnitTotal}
						label={t("Service owners")}
						onChange={setSelectedOwnerUnitDocumentIds}
						placeholder={t("No service owners")}
						selectedItems={selectedOrganisationalUnits}
						value={selectedOwnerUnitDocumentIds}
					/>
					{selectedOwnerUnitDocumentIds.map((documentId, index) => (
						<input
							key={documentId}
							name={`ownerUnitDocumentIds.${String(index)}`}
							type="hidden"
							value={documentId}
						/>
					))}

					<AsyncMultipleSelect
						aria-label={t("Service providers")}
						fetchPage={fetchOrganisationalUnitOptionsPage}
						initialItems={initialOrganisationalUnitItems}
						initialTotal={initialOrganisationalUnitTotal}
						label={t("Service providers")}
						onChange={setSelectedProviderUnitDocumentIds}
						placeholder={t("No service providers")}
						selectedItems={selectedOrganisationalUnits}
						value={selectedProviderUnitDocumentIds}
					/>
					{selectedProviderUnitDocumentIds.map((documentId, index) => (
						<input
							key={documentId}
							name={`providerUnitDocumentIds.${String(index)}`}
							type="hidden"
							value={documentId}
						/>
					))}
				</FormSection>

				{service != null && <input name="id" type="hidden" value={service.id} />}

				<Button className="self-start" isPending={isPending} type="submit">
					{isPending ? (
						<Fragment>
							<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
							<span aria-hidden={true}>{t("Saving...")}</span>
						</Fragment>
					) : (
						t("Save")
					)}
				</Button>

				<FormStatus className="self-start" state={state} />
			</Form>
		</FormLayout>
	);
}
