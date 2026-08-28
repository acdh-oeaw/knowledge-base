"use client";

import type * as schema from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { Input } from "@dariah-eric/ui/input";
import { Separator } from "@dariah-eric/ui/separator";
import { TextField } from "@dariah-eric/ui/text-field";
import { TextArea } from "@dariah-eric/ui/textarea";
import { useExtracted } from "next-intl";
import { type ReactNode, useActionState, useState } from "react";

import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import {
	ImageSelectField,
	type SelectedImage,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-select-field";
import { updateSiteMetadataAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/metadata/_lib/update-site-metadata.action";

interface SiteMetadataFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	siteMetadata:
		| (Pick<schema.SiteMetadata, "title" | "description" | "ogTitle" | "ogDescription"> & {
				ogImage: SelectedImage | null;
		  })
		| null;
}

export function SiteMetadataForm(props: Readonly<SiteMetadataFormProps>): ReactNode {
	const { initialAssets, siteMetadata } = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(
		updateSiteMetadataAction,
		createActionStateInitial(),
	);

	const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(
		siteMetadata?.ogImage ?? null,
	);

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection
					description={t("Default title and description for the website.")}
					title={t("Details")}
				>
					<TextField defaultValue={siteMetadata?.title ?? undefined} isRequired={true} name="title">
						<Label>{t("Title")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={siteMetadata?.description ?? undefined}
						isRequired={true}
						name="description"
					>
						<Label>{t("Description")}</Label>
						<TextArea rows={5} />
						<FieldError />
					</TextField>
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t(
						"Override title and description for social media previews. Leave blank to use the values above.",
					)}
					title={t("Open Graph")}
				>
					<TextField defaultValue={siteMetadata?.ogTitle ?? undefined} name="ogTitle">
						<Label>{t("OG title")}</Label>
						<Input placeholder={siteMetadata?.title ?? t("Defaults to title")} />
						<FieldError />
					</TextField>

					<TextField defaultValue={siteMetadata?.ogDescription ?? undefined} name="ogDescription">
						<Label>{t("OG description")}</Label>
						<TextArea
							placeholder={siteMetadata?.description ?? t("Defaults to description")}
							rows={3}
						/>
						<FieldError />
					</TextField>
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t("Image used when the website is shared on social media.")}
					title={t("Open Graph image")}
				>
					<ImageSelectField
						allowRemove={true}
						defaultPrefix="images"
						initialAssets={initialAssets}
						onChange={setSelectedImage}
						prefixes={["avatars", "images", "logos"]}
						selectedImage={selectedImage}
					/>
				</FormSection>

				<div className="flex items-center justify-end gap-x-3">
					<FormStatus className="text-sm" state={state} />

					<Button isPending={isPending} type="submit">
						{isPending ? <span aria-hidden={true}>{t("Saving...")}</span> : t("Save")}
					</Button>
				</div>
			</Form>
		</FormLayout>
	);
}
