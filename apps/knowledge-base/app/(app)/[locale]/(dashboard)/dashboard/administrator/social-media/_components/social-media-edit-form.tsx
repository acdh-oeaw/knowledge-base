"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { Heading } from "@acdh-knowledge-base/ui/heading";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { SocialMediaForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/social-media/_components/social-media-form";
import { updateSocialMediaAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/social-media/_lib/update-social-media.action";

interface SocialMediaEditFormProps {
	socialMedia: Pick<schema.SocialMedia, "id" | "name" | "url"> & {
		type: Pick<schema.SocialMediaType, "type">;
		durationStart: string | null;
		durationEnd: string | null;
	};
}

export function SocialMediaEditForm(props: Readonly<SocialMediaEditFormProps>): ReactNode {
	const { socialMedia } = props;

	const t = useExtracted();

	return (
		<Fragment>
			<Heading>{t("Edit social media")}</Heading>

			<SocialMediaForm formAction={updateSocialMediaAction} socialMedia={socialMedia} />
		</Fragment>
	);
}
