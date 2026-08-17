"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { DatePicker, DatePickerTrigger } from "@dariah-eric/ui/date-picker";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { Input } from "@dariah-eric/ui/input";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { TextField } from "@dariah-eric/ui/text-field";
import { useExtracted, useFormatter } from "next-intl";
import { Fragment, type ReactNode, useActionState } from "react";

import type { ServerAction } from "@/lib/server/create-server-action";

interface ReportEvent {
	id: string;
	title: string;
	date: Date;
	url: string | null;
	role: "organiser" | "presenter";
}

interface WorkingGroupReportEventsFormProps {
	report: {
		id: string;
		events: Array<ReportEvent>;
	};
	addAction: ServerAction;
	deleteAction: (formData: FormData) => Promise<void>;
}

export function WorkingGroupReportEventsForm(
	props: Readonly<WorkingGroupReportEventsFormProps>,
): ReactNode {
	const { report, addAction, deleteAction } = props;

	const t = useExtracted();
	const format = useFormatter();
	const [state, action, isPending] = useActionState(addAction, createActionStateInitial());

	return (
		<div className="flex flex-col gap-y-8">
			{report.events.length > 0 && (
				<section className="flex flex-col gap-y-3">
					<h2 className="text-sm font-semibold text-fg">{t("Events")}</h2>
					<ul className="divide-y divide-border rounded-md border">
						{report.events.map((event) => (
							<li key={event.id} className="flex items-start justify-between gap-x-4 px-4 py-3">
								<div className="flex flex-col gap-y-0.5">
									<p className="text-sm font-medium text-fg">{event.title}</p>
									<p className="text-xs text-muted-fg">
										{format.dateTime(event.date, { dateStyle: "medium" })}
										{" · "}
										{event.role.charAt(0).toUpperCase() + event.role.slice(1)}
									</p>
									{event.url != null && <p className="text-xs text-muted-fg">{event.url}</p>}
								</div>
								<form action={deleteAction}>
									<input name="eventId" type="hidden" value={event.id} />
									<input name="workingGroupReportId" type="hidden" value={report.id} />
									<Button intent="danger" size="sm" type="submit">
										{t("Remove")}
									</Button>
								</form>
							</li>
						))}
					</ul>
				</section>
			)}

			<section className="flex flex-col gap-y-3">
				<h2 className="text-sm font-semibold text-fg">{t("Add event")}</h2>
				<Form action={action} className="flex flex-col gap-y-4 max-inline-sm" state={state}>
					<input name="workingGroupReportId" type="hidden" value={report.id} />

					<TextField isRequired={true} name="title">
						<Label>{t("Title")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<DatePicker granularity="day" isRequired={true} name="date">
						<Label>{t("Date")}</Label>
						<DatePickerTrigger />
						<FieldError />
					</DatePicker>

					<TextField name="url">
						<Label>{t("URL")}</Label>
						<Input type="url" />
						<FieldError />
					</TextField>

					<Select isRequired={true} name="role">
						<Label>{t("Role")}</Label>
						<SelectTrigger />
						<FieldError />
						<SelectContent>
							<SelectItem id="organiser">{t("Organiser")}</SelectItem>
							<SelectItem id="presenter">{t("Presenter")}</SelectItem>
						</SelectContent>
					</Select>

					<Button className="self-start" isPending={isPending} type="submit">
						{isPending ? (
							<Fragment>
								<ProgressCircle aria-label={t("Adding...")} isIndeterminate={true} />
								<span aria-hidden={true}>{t("Adding...")}</span>
							</Fragment>
						) : (
							t("Add event")
						)}
					</Button>

					<FormStatus className="self-start" state={state} />
				</Form>
			</section>
		</div>
	);
}
