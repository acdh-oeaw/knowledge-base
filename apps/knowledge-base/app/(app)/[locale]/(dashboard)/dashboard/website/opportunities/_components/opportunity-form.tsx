"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { DatePicker, DatePickerTrigger } from "@acdh-knowledge-base/ui/date-picker";
import { FieldError, Label } from "@acdh-knowledge-base/ui/field";
import { Form } from "@acdh-knowledge-base/ui/form";
import { Input } from "@acdh-knowledge-base/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@acdh-knowledge-base/ui/select";
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

interface OpportunityFormProps {
	contentBlocks?: Array<ContentBlock>;
	opportunity?: Pick<schema.Opportunity, "id" | "duration" | "title" | "summary" | "website"> & {
		entityVersion: {
			entity: Pick<schema.Entity, "id" | "slug">;
			status: Pick<schema.EntityStatus, "id" | "type">;
		};
		source: Pick<schema.OpportunitySource, "id" | "source">;
	};
	formAction: ServerAction;
	sources: Array<Pick<schema.OpportunitySource, "id" | "source">>;
}

export function OpportunityForm(props: Readonly<OpportunityFormProps>): ReactNode {
	const { contentBlocks, formAction, opportunity, sources } = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection description={t("Enter the opportunity details.")} title={t("Details")}>
					<TextField defaultValue={opportunity?.title} isRequired={true} name="title">
						<Label>{t("Title")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<Select
						defaultValue={opportunity?.source.id ?? undefined}
						isRequired={true}
						name="sourceId"
					>
						<Label>{t("Source")}</Label>
						<SelectTrigger />
						<FieldError />
						<SelectContent>
							{sources.map((item) => (
								<SelectItem key={item.id} id={item.id}>
									{item.source}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<TextField defaultValue={opportunity?.summary ?? undefined} name="summary">
						<Label>{t("Summary")}</Label>
						<TextArea rows={5} />
						<FieldError />
					</TextField>
					<DatePicker
						defaultValue={
							opportunity != null
								? new CalendarDate(
										opportunity.duration.start.getUTCFullYear(),
										opportunity.duration.start.getUTCMonth() + 1,
										opportunity.duration.start.getUTCDate(),
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
							opportunity?.duration.end != null
								? new CalendarDate(
										opportunity.duration.end.getUTCFullYear(),
										opportunity.duration.end.getUTCMonth() + 1,
										opportunity.duration.end.getUTCDate(),
									)
								: undefined
						}
						granularity="day"
						name="duration.end"
					>
						<Label>{t("End date")}</Label>
						<DatePickerTrigger />
					</DatePicker>
					<TextField defaultValue={opportunity?.website ?? undefined} name="website" type="url">
						<Label>{t("Website")}</Label>
						<Input placeholder="https://" />
						<FieldError />
					</TextField>
				</FormSection>

				<Separator className="my-6" />

				<FormSection description={t("Add the content.")} title={t("Content")} variant="stacked">
					<ContentBlocks items={contentBlocks ?? []} />
				</FormSection>

				{opportunity != null ? (
					<Fragment>
						<input name="id" type="hidden" value={opportunity.id} />
						<input name="documentId" type="hidden" value={opportunity.entityVersion.entity.id} />
					</Fragment>
				) : null}

				<EntityFormActions entityName={t("Opportunity")} isPending={isPending} state={state} />
			</Form>
		</FormLayout>
	);
}
