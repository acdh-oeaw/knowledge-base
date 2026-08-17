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

interface CampaignServiceSizesFormProps {
	campaignId: string;
	sizes: Array<
		Pick<schema.ReportingCampaignServiceSize, "serviceSize" | "visitsThreshold" | "amount">
	>;
	formAction: ServerAction;
}

export function CampaignServiceSizesForm(
	props: Readonly<CampaignServiceSizesFormProps>,
): ReactNode {
	const { campaignId, sizes, formAction } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const sizeMap = Object.fromEntries(
		sizes.map((s) => [
			s.serviceSize,
			{
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				amount: s.amount != null ? String(s.amount) : undefined,
				threshold: s.visitsThreshold != null ? String(s.visitsThreshold) : undefined,
			},
		]),
	);

	return (
		<FormLayout variant="stacked">
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<input name="id" type="hidden" value={campaignId} />

				<FormSection title={t("Tiered service sizes")}>
					<TextField defaultValue={sizeMap.small?.threshold} name="small_threshold" type="number">
						<Label>{t("Small — visits threshold")}</Label>
						<Input min={0} />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={sizeMap.small?.amount ?? undefined}
						name="small_amount"
						type="number"
					>
						<Label>{t("Small — amount")}</Label>
						<Input min={0} step="0.01" />
						<FieldError />
					</TextField>

					<TextField defaultValue={sizeMap.medium?.threshold} name="medium_threshold" type="number">
						<Label>{t("Medium — visits threshold")}</Label>
						<Input min={0} />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={sizeMap.medium?.amount ?? undefined}
						name="medium_amount"
						type="number"
					>
						<Label>{t("Medium — amount")}</Label>
						<Input min={0} step="0.01" />
						<FieldError />
					</TextField>

					<TextField defaultValue={sizeMap.large?.threshold} name="large_threshold" type="number">
						<Label>{t("Large — visits threshold")}</Label>
						<Input min={0} />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={sizeMap.large?.amount ?? undefined}
						name="large_amount"
						type="number"
					>
						<Label>{t("Large — amount")}</Label>
						<Input min={0} step="0.01" />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={sizeMap.very_large?.threshold}
						name="very_large_threshold"
						type="number"
					>
						<Label>{t("Very large — visits threshold")}</Label>
						<Input min={0} />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={sizeMap.very_large?.amount ?? undefined}
						name="very_large_amount"
						type="number"
					>
						<Label>{t("Very large — amount")}</Label>
						<Input min={0} step="0.01" />
						<FieldError />
					</TextField>
				</FormSection>

				<FormSection title={t("Core services")}>
					<TextField
						defaultValue={sizeMap.core?.amount ?? undefined}
						name="core_amount"
						type="number"
					>
						<Label>{t("Core service amount")}</Label>
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
