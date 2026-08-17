"use client";

import type * as schema from "@dariah-eric/database/schema";
import { socialMediaTypesEnum } from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { DatePicker, DatePickerTrigger } from "@dariah-eric/ui/date-picker";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { Input } from "@dariah-eric/ui/input";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { Separator } from "@dariah-eric/ui/separator";
import { TextField } from "@dariah-eric/ui/text-field";
import { parseDate } from "@internationalized/date";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import type { ServerAction } from "@/lib/server/create-server-action";

interface SocialMediaFormProps {
	socialMedia?: Pick<schema.SocialMedia, "id" | "name" | "url"> & {
		type: Pick<schema.SocialMediaType, "type">;
		durationStart: string | null;
		durationEnd: string | null;
	};
	formAction: ServerAction;
}

function formatType(type: string): string {
	return type.charAt(0).toUpperCase() + type.slice(1);
}

export function SocialMediaForm(props: Readonly<SocialMediaFormProps>): ReactNode {
	const { socialMedia, formAction } = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const [selectedType, setSelectedType] = useState<string>(socialMedia?.type.type ?? "");

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection description={t("Enter the social media details.")} title={t("Details")}>
					<TextField defaultValue={socialMedia?.name} isRequired={true} name="name">
						<Label>{t("Name")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<TextField defaultValue={socialMedia?.url} isRequired={true} name="url" type="url">
						<Label>{t("URL")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<Select
						isRequired={true}
						onChange={(key) => {
							setSelectedType(String(key));
						}}
						value={selectedType || null}
					>
						<Label>{t("Type")}</Label>
						<SelectTrigger />
						<FieldError />
						<SelectContent>
							{socialMediaTypesEnum.map((type) => (
								<SelectItem key={type} id={type}>
									{formatType(type)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<input name="type" type="hidden" value={selectedType} />
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t("Optionally set the active date range for this social media account.")}
					title={t("Duration")}
				>
					<DatePicker
						defaultValue={
							socialMedia?.durationStart != null ? parseDate(socialMedia.durationStart) : null
						}
						granularity="day"
						name="duration.start"
					>
						<Label>{t("Start date")}</Label>
						<DatePickerTrigger />
						<FieldError />
					</DatePicker>

					<DatePicker
						defaultValue={
							socialMedia?.durationEnd != null ? parseDate(socialMedia.durationEnd) : null
						}
						granularity="day"
						name="duration.end"
					>
						<Label>{t("End date")}</Label>
						<DatePickerTrigger />
						<FieldError />
					</DatePicker>
				</FormSection>

				{socialMedia != null && <input name="id" type="hidden" value={socialMedia.id} />}

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
