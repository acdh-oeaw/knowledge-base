"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { DatePicker, DatePickerTrigger } from "@acdh-knowledge-base/ui/date-picker";
import { FieldError, Label } from "@acdh-knowledge-base/ui/field";
import { Form } from "@acdh-knowledge-base/ui/form";
import { Input } from "@acdh-knowledge-base/ui/input";
import { Separator } from "@acdh-knowledge-base/ui/separator";
import { TextField } from "@acdh-knowledge-base/ui/text-field";
import { TextArea } from "@acdh-knowledge-base/ui/textarea";
import { CalendarDate } from "@internationalized/date";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState } from "react";

import {
	type ContentBlock,
	ContentBlocks,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form-actions";
import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import type { ServerAction } from "@/lib/server/create-server-action";

interface FundingCallFormProps {
	contentBlocks?: Array<ContentBlock>;
	fundingCall?: Pick<schema.FundingCall, "id" | "duration" | "title" | "summary"> & {
		entityVersion: {
			entity: Pick<schema.Entity, "id" | "slug">;
			status: Pick<schema.EntityStatus, "id" | "type">;
		};
	};
	formAction: ServerAction;
}

export function FundingCallForm(props: Readonly<FundingCallFormProps>): ReactNode {
	const { contentBlocks, formAction, fundingCall } = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection description={t("Enter the funding call details.")} title={t("Details")}>
					<TextField defaultValue={fundingCall?.title} isRequired={true} name="title">
						<Label>{t("Title")}</Label>
						<Input />
						<FieldError />
					</TextField>
					<TextField defaultValue={fundingCall?.summary ?? undefined} name="summary">
						<Label>{t("Summary")}</Label>
						<TextArea rows={5} />
						<FieldError />
					</TextField>
					<DatePicker
						defaultValue={
							fundingCall != null
								? new CalendarDate(
										fundingCall.duration.start.getUTCFullYear(),
										fundingCall.duration.start.getUTCMonth() + 1,
										fundingCall.duration.start.getUTCDate(),
									)
								: undefined
						}
						granularity="day"
						isRequired={true}
						name="duration.start"
					>
						<Label>{t("Start date")}</Label>
						<DatePickerTrigger />
					</DatePicker>

					<DatePicker
						defaultValue={
							fundingCall?.duration.end != null
								? new CalendarDate(
										fundingCall.duration.end.getUTCFullYear(),
										fundingCall.duration.end.getUTCMonth() + 1,
										fundingCall.duration.end.getUTCDate(),
									)
								: undefined
						}
						granularity="day"
						name="duration.end"
					>
						<Label>{t("End date")}</Label>
						<DatePickerTrigger />
					</DatePicker>
				</FormSection>

				<Separator className="my-6" />

				<FormSection description={t("Add the content.")} title={t("Content")} variant="stacked">
					<ContentBlocks items={contentBlocks ?? []} />
				</FormSection>

				{fundingCall != null ? (
					<Fragment>
						<input name="id" type="hidden" value={fundingCall.id} />
						<input name="documentId" type="hidden" value={fundingCall.entityVersion.entity.id} />
					</Fragment>
				) : null}

				<EntityFormActions entityName={t("Funding call")} isPending={isPending} state={state} />
			</Form>
		</FormLayout>
	);
}
