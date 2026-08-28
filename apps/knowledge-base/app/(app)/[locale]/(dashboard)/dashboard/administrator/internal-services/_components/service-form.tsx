"use client";

import type * as schema from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { AsyncListSelect } from "@dariah-eric/ui/async-list-select";
import { Button } from "@dariah-eric/ui/button";
import { Checkbox } from "@dariah-eric/ui/checkbox";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { Input } from "@dariah-eric/ui/input";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { Separator } from "@dariah-eric/ui/separator";
import { TextField } from "@dariah-eric/ui/text-field";
import { TextArea } from "@dariah-eric/ui/textarea";
import type { AsyncOption, AsyncOptionsFetchPageParams } from "@dariah-eric/ui/use-async-options";
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
import { getServiceStatusLabel } from "@/lib/service-status-label";

interface ServiceFormProps {
	service?: Pick<
		schema.Service,
		| "id"
		| "name"
		| "typeId"
		| "statusId"
		| "comment"
		| "dariahBranding"
		| "monitoring"
		| "privateSupplier"
	> & {
		ownerUnitDocumentIds: Array<string>;
		providerUnitDocumentIds: Array<string>;
	};
	serviceTypes: Array<Pick<schema.ServiceType, "id" | "type">>;
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

export function ServiceForm(props: Readonly<ServiceFormProps>): ReactNode {
	const {
		service,
		serviceTypes,
		serviceStatuses,
		initialOrganisationalUnitItems,
		initialOrganisationalUnitTotal,
		selectedOrganisationalUnits,
		formAction,
	} = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const defaultTypeId =
		service?.typeId ??
		serviceTypes.find((serviceType) => serviceType.type === "internal")?.id ??
		"";
	const [selectedTypeId, setSelectedTypeId] = useState<string>(defaultTypeId);
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
							setSelectedTypeId(String(key));
						}}
						value={selectedTypeId || null}
					>
						<Label>{t("Type")}</Label>
						<SelectTrigger />
						<FieldError />
						<SelectContent>
							{serviceTypes.map((serviceType) => (
								<SelectItem key={serviceType.id} id={serviceType.id}>
									{serviceType.type}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<input name="typeId" type="hidden" value={selectedTypeId} />
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
									{getServiceStatusLabel(status.status)}
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
					<AsyncListSelect
						addLabel={t("Add service owner")}
						aria-label={t("Service owners")}
						emptySelectionMessage={t("No service owners")}
						fetchPage={fetchOrganisationalUnitOptionsPage}
						initialItems={initialOrganisationalUnitItems}
						initialTotal={initialOrganisationalUnitTotal}
						label={t("Service owners")}
						onChange={setSelectedOwnerUnitDocumentIds}
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

					<AsyncListSelect
						addLabel={t("Add service provider")}
						aria-label={t("Service providers")}
						emptySelectionMessage={t("No service providers")}
						fetchPage={fetchOrganisationalUnitOptionsPage}
						initialItems={initialOrganisationalUnitItems}
						initialTotal={initialOrganisationalUnitTotal}
						label={t("Service providers")}
						onChange={setSelectedProviderUnitDocumentIds}
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
