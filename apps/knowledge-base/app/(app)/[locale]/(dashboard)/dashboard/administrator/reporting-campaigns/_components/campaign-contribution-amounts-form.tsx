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

interface CampaignContributionAmountsFormProps {
	campaignId: string;
	amounts: Array<Pick<schema.ReportingCampaignContributionAmount, "roleType" | "amount">>;
	formAction: ServerAction;
}

export function CampaignContributionAmountsForm(
	props: Readonly<CampaignContributionAmountsFormProps>,
): ReactNode {
	const { campaignId, amounts, formAction } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const amountMap = Object.fromEntries(amounts.map((a) => [a.roleType, String(a.amount)]));

	return (
		<FormLayout variant="stacked">
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<input name="id" type="hidden" value={campaignId} />

				<FormSection title={t("Contribution amounts")}>
					<TextField
						defaultValue={amountMap.national_coordinator ?? undefined}
						name="national_coordinator"
						type="number"
					>
						<Label>{t("National coordinator")}</Label>
						<Input min={0} step="0.01" />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={amountMap.national_coordinator_deputy ?? undefined}
						name="national_coordinator_deputy"
						type="number"
					>
						<Label>{t("National coordinator deputy")}</Label>
						<Input min={0} step="0.01" />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={amountMap.national_representative ?? undefined}
						name="national_representative"
						type="number"
					>
						<Label>{t("National representative")}</Label>
						<Input min={0} step="0.01" />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={amountMap.national_representative_deputy ?? undefined}
						name="national_representative_deputy"
						type="number"
					>
						<Label>{t("National representative deputy")}</Label>
						<Input min={0} step="0.01" />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={amountMap.is_chair_of ?? undefined}
						name="is_chair_of"
						type="number"
					>
						<Label>{t("WG chair")}</Label>
						<Input min={0} step="0.01" />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={amountMap.is_vice_chair_of ?? undefined}
						name="is_vice_chair_of"
						type="number"
					>
						<Label>{t("WG vice-chair")}</Label>
						<Input min={0} step="0.01" />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={amountMap.is_member_of ?? undefined}
						name="is_member_of"
						type="number"
					>
						<Label>{t("WG member")}</Label>
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
