"use client";

import { Button } from "@dariah-eric/ui/button";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useEffect, useState } from "react";

import { saveAndPublishIntent } from "@/lib/form-intent";

type SubmitIntent = "draft" | "publish";

interface DraftFormSubmitButtonsProps {
	draftLabel?: string;
	isDisabled?: boolean;
	isPending: boolean;
	publishLabel?: string;
	saveLabel?: string;
	showSaveAndPublish?: boolean;
}

export function DraftFormSubmitButtons(props: Readonly<DraftFormSubmitButtonsProps>): ReactNode {
	const {
		draftLabel,
		isDisabled,
		isPending,
		publishLabel,
		saveLabel,
		showSaveAndPublish = false,
	} = props;
	const t = useExtracted();
	const [pendingIntent, setPendingIntent] = useState<SubmitIntent | null>(null);

	useEffect(() => {
		if (!isPending) {
			setPendingIntent(null);
		}
	}, [isPending]);

	const isDraftPending = isPending && pendingIntent !== "publish";
	const isPublishPending = isPending && pendingIntent === "publish";
	const isFormDisabled = isDisabled === true;

	const pendingContent = (
		<Fragment>
			<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
			<span aria-hidden={true}>{t("Saving...")}</span>
		</Fragment>
	);

	return (
		<Fragment>
			<Button
				isDisabled={isFormDisabled || isPublishPending}
				isPending={isDraftPending}
				onPress={() => {
					setPendingIntent("draft");
				}}
				type="submit"
			>
				{isDraftPending
					? pendingContent
					: showSaveAndPublish
						? (draftLabel ?? t("Save (as draft)"))
						: (saveLabel ?? t("Save"))}
			</Button>
			{showSaveAndPublish ? (
				<Button
					intent="primary"
					isDisabled={isFormDisabled || isDraftPending}
					isPending={isPublishPending}
					name="intent"
					onPress={() => {
						setPendingIntent("publish");
					}}
					type="submit"
					value={saveAndPublishIntent}
				>
					{isPublishPending ? pendingContent : (publishLabel ?? t("Save and publish"))}
				</Button>
			) : null}
		</Fragment>
	);
}
