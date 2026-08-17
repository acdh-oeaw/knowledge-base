"use client";

import type * as schema from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { Input } from "@dariah-eric/ui/input";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { TextField } from "@dariah-eric/ui/text-field";
import { TextArea } from "@dariah-eric/ui/textarea";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState } from "react";

import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import type { ServerAction } from "@/lib/server/create-server-action";

interface CountryReportEventsFormProps {
	report: Pick<
		schema.CountryReport,
		| "id"
		| "smallEvents"
		| "mediumEvents"
		| "largeEvents"
		| "veryLargeEvents"
		| "dariahCommissionedEvent"
		| "reusableOutcomes"
	>;
	formAction: ServerAction;
}

export function CountryReportEventsForm(props: Readonly<CountryReportEventsFormProps>): ReactNode {
	const { report, formAction } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	return (
		<FormLayout variant="stacked">
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<input name="id" type="hidden" value={report.id} />

				<FormSection title={t("Event counts")}>
					<TextField
						defaultValue={report.smallEvents != null ? String(report.smallEvents) : undefined}
						name="smallEvents"
						type="number"
					>
						<Label>{t("Small events")}</Label>
						<Input min={0} />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={report.mediumEvents != null ? String(report.mediumEvents) : undefined}
						name="mediumEvents"
						type="number"
					>
						<Label>{t("Medium events")}</Label>
						<Input min={0} />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={report.largeEvents != null ? String(report.largeEvents) : undefined}
						name="largeEvents"
						type="number"
					>
						<Label>{t("Large events")}</Label>
						<Input min={0} />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={
							report.veryLargeEvents != null ? String(report.veryLargeEvents) : undefined
						}
						name="veryLargeEvents"
						type="number"
					>
						<Label>{t("Very large events")}</Label>
						<Input min={0} />
						<FieldError />
					</TextField>
				</FormSection>

				<FormSection title={t("DARIAH commissioned event")}>
					<TextField
						defaultValue={report.dariahCommissionedEvent ?? undefined}
						name="dariahCommissionedEvent"
					>
						<Label>{t("Title")}</Label>
						<Input />
						<FieldError />
					</TextField>
				</FormSection>

				<FormSection title={t("Reusable outcomes")}>
					<TextField defaultValue={report.reusableOutcomes ?? undefined} name="reusableOutcomes">
						<Label>{t("Description")}</Label>
						<TextArea rows={5} />
						<FieldError />
					</TextField>
				</FormSection>

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
