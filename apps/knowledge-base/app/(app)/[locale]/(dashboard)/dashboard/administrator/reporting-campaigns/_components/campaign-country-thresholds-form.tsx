"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { Button } from "@acdh-knowledge-base/ui/button";
import { FieldError, Label } from "@acdh-knowledge-base/ui/field";
import { Form } from "@acdh-knowledge-base/ui/form";
import { FormStatus } from "@acdh-knowledge-base/ui/form-status";
import { Input } from "@acdh-knowledge-base/ui/input";
import { ProgressCircle } from "@acdh-knowledge-base/ui/progress-circle";
import { TextField } from "@acdh-knowledge-base/ui/text-field";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState } from "react";

import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import type { ServerAction } from "@/lib/server/create-server-action";

interface Country {
	id: string;
	name: string;
}

interface CampaignCountryThresholdsFormProps {
	campaignId: string;
	countries: Array<Country>;
	thresholds: Array<Pick<schema.ReportingCampaignCountryThreshold, "countryDocumentId" | "amount">>;
	formAction: ServerAction;
}

export function CampaignCountryThresholdsForm(
	props: Readonly<CampaignCountryThresholdsFormProps>,
): ReactNode {
	const { campaignId, countries, thresholds, formAction } = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const thresholdMap = Object.fromEntries(
		thresholds.map((th) => [th.countryDocumentId, String(th.amount)]),
	);

	return (
		<FormLayout variant="stacked">
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<input name="id" type="hidden" value={campaignId} />

				<FormSection title={t("Country thresholds")}>
					{countries.map((country) => (
						<TextField
							key={country.id}
							defaultValue={thresholdMap[country.id]}
							name={`amounts.${country.id}`}
							type="number"
						>
							<Label>{country.name}</Label>
							<Input min={0} step="0.01" />
							<FieldError />
						</TextField>
					))}
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
