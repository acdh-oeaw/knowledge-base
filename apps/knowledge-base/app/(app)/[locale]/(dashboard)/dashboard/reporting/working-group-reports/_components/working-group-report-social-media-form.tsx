"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import type { ServerAction } from "@/lib/server/create-server-action";

interface AvailableSocialMedia {
	id: string;
	name: string;
	url: string | null;
}

interface ClaimedSocialMedia {
	id: string;
	socialMediaId: string;
	socialMedia: { id: string; name: string; url: string | null };
}

interface WorkingGroupReportSocialMediaFormProps {
	report: {
		id: string;
		socialMedia: Array<ClaimedSocialMedia>;
	};
	availableSocialMedia: Array<AvailableSocialMedia>;
	addAction: ServerAction;
	deleteAction: (formData: FormData) => Promise<void>;
}

export function WorkingGroupReportSocialMediaForm(
	props: Readonly<WorkingGroupReportSocialMediaFormProps>,
): ReactNode {
	const { report, availableSocialMedia, addAction, deleteAction } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(addAction, createActionStateInitial());
	const [selectedId, setSelectedId] = useState<string>("");

	return (
		<div className="flex flex-col gap-y-8">
			{report.socialMedia.length > 0 && (
				<section className="flex flex-col gap-y-3">
					<h2 className="text-sm font-semibold text-fg">{t("Social media accounts")}</h2>
					<ul className="divide-y divide-border rounded-md border max-inline-sm">
						{report.socialMedia.map((claimed) => (
							<li key={claimed.id} className="flex items-center justify-between gap-x-4 px-4 py-3">
								<div>
									<p className="text-sm font-medium text-fg">{claimed.socialMedia.name}</p>
									{claimed.socialMedia.url != null && (
										<p className="text-xs text-muted-fg">{claimed.socialMedia.url}</p>
									)}
								</div>
								<form action={deleteAction}>
									<input name="claimedId" type="hidden" value={claimed.id} />
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

			{availableSocialMedia.length > 0 && (
				<section className="flex flex-col gap-y-3">
					<h2 className="text-sm font-semibold text-fg">{t("Add social media account")}</h2>
					<Form action={action} className="flex flex-col gap-y-4 max-inline-sm" state={state}>
						<input name="workingGroupReportId" type="hidden" value={report.id} />

						<Select
							isRequired={true}
							onChange={(key) => {
								setSelectedId(String(key));
							}}
							value={selectedId || null}
						>
							<Label>{t("Account")}</Label>
							<SelectTrigger />
							<FieldError />
							<SelectContent>
								{availableSocialMedia.map((account) => (
									<SelectItem key={account.id} id={account.id}>
										{account.name}
										{account.url != null && ` (${account.url})`}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<input name="socialMediaId" type="hidden" value={selectedId} />

						<Button className="self-start" isPending={isPending} type="submit">
							{isPending ? (
								<Fragment>
									<ProgressCircle aria-label={t("Adding...")} isIndeterminate={true} />
									<span aria-hidden={true}>{t("Adding...")}</span>
								</Fragment>
							) : (
								t("Add")
							)}
						</Button>

						<FormStatus className="self-start" state={state} />
					</Form>
				</section>
			)}

			{report.socialMedia.length === 0 && availableSocialMedia.length === 0 && (
				<p className="text-sm text-muted-fg">
					{t("No social media accounts linked to this working group.")}
				</p>
			)}
		</div>
	);
}
