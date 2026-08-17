"use client";

import { FormStatus } from "@dariah-eric/ui/form-status";
import { Separator } from "@dariah-eric/ui/separator";
import { useExtracted } from "next-intl";
import type { ComponentProps, ReactNode } from "react";

import { DraftFormSubmitButtons } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/draft-form-submit-buttons";
import { FormActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";

interface EntityFormActionsProps {
	entityName: string;
	isDisabled?: boolean;
	isPending: boolean;
	showSaveAndPublish?: boolean;
	state: ComponentProps<typeof FormStatus>["state"];
}

export function EntityFormActions(props: Readonly<EntityFormActionsProps>): ReactNode {
	const { entityName, isDisabled, isPending, showSaveAndPublish = true, state } = props;

	const t = useExtracted();
	const normalizedEntityName = entityName.toLocaleLowerCase();

	return (
		<>
			<Separator className="my-6" />

			<FormActions className="flex-col items-start justify-start gap-y-4">
				<div className="space-y-1">
					<p className="text-sm font-semibold text-fg">
						{t("{entityName} actions", { entityName })}
					</p>
					<p className="text-sm text-neutral-500">
						{t("These actions save the {entityName} details above.", {
							entityName: normalizedEntityName,
						})}
					</p>
					<FormStatus state={state} />
				</div>
				<div className="flex flex-wrap items-center gap-4">
					<DraftFormSubmitButtons
						draftLabel={t("Save {entityName} as draft", {
							entityName: normalizedEntityName,
						})}
						isDisabled={isDisabled}
						isPending={isPending}
						publishLabel={t("Save and publish {entityName}", {
							entityName: normalizedEntityName,
						})}
						saveLabel={t("Save {entityName}", { entityName: normalizedEntityName })}
						showSaveAndPublish={showSaveAndPublish}
					/>
				</div>
			</FormActions>
		</>
	);
}
