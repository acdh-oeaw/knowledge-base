"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { reportingCampaignStatusEnum } from "@acdh-knowledge-base/database/schema";
import { createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { Button } from "@acdh-knowledge-base/ui/button";
import { FieldError, Label } from "@acdh-knowledge-base/ui/field";
import { Form } from "@acdh-knowledge-base/ui/form";
import { FormStatus } from "@acdh-knowledge-base/ui/form-status";
import { Input } from "@acdh-knowledge-base/ui/input";
import { ProgressCircle } from "@acdh-knowledge-base/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@acdh-knowledge-base/ui/select";
import { TextField } from "@acdh-knowledge-base/ui/text-field";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import type { ServerAction } from "@/lib/server/create-server-action";

interface ReportingCampaignFormProps {
	campaign?: Pick<schema.ReportingCampaign, "id" | "year" | "status">;
	formAction: ServerAction;
}

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ReportingCampaignForm(props: Readonly<ReportingCampaignFormProps>): ReactNode {
	const { campaign, formAction } = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const [selectedStatus, setSelectedStatus] = useState<string>(campaign?.status ?? "open");

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection description={t("Enter the campaign details.")} title={t("Details")}>
					<TextField
						defaultValue={campaign?.year != null ? String(campaign.year) : undefined}
						isRequired={true}
						name="year"
						type="number"
					>
						<Label>{t("Year")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<Select
						isRequired={true}
						onChange={(key) => {
							setSelectedStatus(String(key));
						}}
						value={selectedStatus || null}
					>
						<Label>{t("Status")}</Label>
						<SelectTrigger />
						<FieldError />
						<SelectContent>
							{reportingCampaignStatusEnum.map((status) => (
								<SelectItem key={status} id={status}>
									{formatStatus(status)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<input name="status" type="hidden" value={selectedStatus} />
				</FormSection>

				{campaign != null && <input name="id" type="hidden" value={campaign.id} />}

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
