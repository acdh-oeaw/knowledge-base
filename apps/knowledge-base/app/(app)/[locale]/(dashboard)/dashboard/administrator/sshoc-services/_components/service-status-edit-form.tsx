"use client";

import type * as schema from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { Heading } from "@dariah-eric/ui/heading";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import { FormSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { updateServiceStatusAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/sshoc-services/_lib/update-service-status.action";
import { getServiceStatusLabel } from "@/lib/service-status-label";

interface ServiceStatusEditFormProps {
	service: Pick<schema.Service, "id" | "name" | "statusId">;
	serviceStatuses: Array<Pick<schema.ServiceStatus, "id" | "status">>;
}

export function ServiceStatusEditForm(props: Readonly<ServiceStatusEditFormProps>): ReactNode {
	const { service, serviceStatuses } = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(
		updateServiceStatusAction,
		createActionStateInitial(),
	);
	const [selectedStatusId, setSelectedStatusId] = useState<string>(service.statusId);

	return (
		<Fragment>
			<Heading>{t("Edit SSHOC service")}</Heading>

			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection
					description={t(
						"Status is the only field not overwritten by the next SSHOC ingest, so it can be changed here.",
					)}
					title={service.name}
				>
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
					<input name="id" type="hidden" value={service.id} />

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
				</FormSection>
			</Form>
		</Fragment>
	);
}
