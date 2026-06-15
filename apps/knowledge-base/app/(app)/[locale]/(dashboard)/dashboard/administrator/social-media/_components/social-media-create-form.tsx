"use client";

import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { SocialMediaForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/social-media/_components/social-media-form";
import { createSocialMediaAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/social-media/_lib/create-social-media.action";

export function SocialMediaCreateForm(): ReactNode {
	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("New social media")} />

			<SocialMediaForm formAction={createSocialMediaAction} />
		</Fragment>
	);
}
