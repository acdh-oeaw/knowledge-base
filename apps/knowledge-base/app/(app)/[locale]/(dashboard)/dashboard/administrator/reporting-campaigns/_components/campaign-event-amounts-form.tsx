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
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState } from "react";

import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import type { ServerAction } from "@/lib/server/create-server-action";

interface CampaignEventAmountsFormProps {
	campaignId: string;
	amounts: Array<Pick<schema.ReportingCampaignEventAmount, "eventType" | "amount">>;
	formAction: ServerAction;
}

export function CampaignEventAmountsForm(
	props: Readonly<CampaignEventAmountsFormProps>,
): ReactNode {
	const { campaignId, amounts, formAction } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const amountMap = Object.fromEntries(amounts.map((a) => [a.eventType, String(a.amount)]));

	return (
		<FormLayout variant="stacked">
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<input name="id" type="hidden" value={campaignId} />

				<FormSection title={t("Event amounts")}>
					<TextField defaultValue={amountMap.small ?? undefined} name="small" type="number">
						<Label>{t("Small events")}</Label>
						<Input min={0} step="0.01" />
						<FieldError />
					</TextField>

					<TextField defaultValue={amountMap.medium ?? undefined} name="medium" type="number">
						<Label>{t("Medium events")}</Label>
						<Input min={0} step="0.01" />
						<FieldError />
					</TextField>

					<TextField defaultValue={amountMap.large ?? undefined} name="large" type="number">
						<Label>{t("Large events")}</Label>
						<Input min={0} step="0.01" />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={amountMap.very_large ?? undefined}
						name="very_large"
						type="number"
					>
						<Label>{t("Very large events")}</Label>
						<Input min={0} step="0.01" />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={amountMap.dariah_commissioned ?? undefined}
						name="dariah_commissioned"
						type="number"
					>
						<Label>{t("DARIAH commissioned event")}</Label>
						<Input min={0} step="0.01" />
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
