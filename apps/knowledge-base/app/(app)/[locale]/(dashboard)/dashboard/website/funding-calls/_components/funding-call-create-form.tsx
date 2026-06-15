"use client";

import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { FundingCallForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_components/funding-call-form";
import { createFundingCallAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_lib/create-funding-call.action";

export function FundingCallCreateForm(): ReactNode {
	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("New funding call")} />

			<FundingCallForm formAction={createFundingCallAction} />
		</Fragment>
	);
}
