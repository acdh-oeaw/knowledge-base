"use client";

import type { ImageCaptionMode } from "@dariah-eric/database/image-captions";
import type * as schema from "@dariah-eric/database/schema";
import { TabList, TabPanel } from "@dariah-eric/ui/tabs";
import type { JSONContent } from "@tiptap/core";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { ContributionsSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/contributions-section";
import {
	EntityEditTab,
	EntityEditTabs,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-edit-tabs";
import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { EntityLifecycleBar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-bar";
import type { SelectedImage } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-select-field";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { PersonForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_components/person-form";
import { discardPersonDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_lib/discard-person-draft.action";
import { publishPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_lib/publish-person.action";
import { updatePersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_lib/update-person.action";
import type { ContributionRoleOption, PersonContribution } from "@/lib/data/contributions";
import type { PersonSocialMediaEntry } from "@/lib/data/person-social-media";

interface PersonEditFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	documentId: string;
	hasDraftChanges: boolean;
	isPublished: boolean;
	isDefaultLocale: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	person: Pick<schema.Person, "email" | "id" | "name" | "orcid" | "sortName"> & {
		biographyContentBlocks?: Array<ContentBlock>;
		entityVersion: { entity: { id: string }; slug: { value: string } };
		socialMedia?: Array<PersonSocialMediaEntry>;
	} & {
		image: SelectedImage | null;
		imageCaption?: JSONContent | null;
		imageCaptionMode?: ImageCaptionMode;
	};
	contributions: Array<PersonContribution>;
	contributionRoleOptions: Array<ContributionRoleOption>;
}

export function PersonEditForm(props: Readonly<PersonEditFormProps>): ReactNode {
	const {
		initialAssets,
		documentId,
		hasDraftChanges,
		isPublished,
		isDefaultLocale,
		locales,
		selectedLocaleCode,
		person,
		contributions,
		contributionRoleOptions,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("Edit person")} />

			<EntityEditTabs defaultTab="details">
				<TabList aria-label={t("Edit person")}>
					<EntityEditTab id="details">{t("Details")}</EntityEditTab>
					<EntityEditTab id="contributions">{t("Contributions")}</EntityEditTab>
				</TabList>

				<TabPanel
					className="flex flex-col gap-y-(--layout-padding)"
					id="details"
					shouldPreserveState={true}
				>
					<div className="flex items-center justify-end gap-x-4">
						<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
						<EntityLifecycleBar
							discardDraftAction={discardPersonDraftAction}
							documentId={documentId}
							hasDraft={hasDraftChanges}
							isPublished={isPublished}
							publishAction={publishPersonAction}
						/>
					</div>

					<PersonForm
						key={person.id}
						formAction={updatePersonAction}
						initialAssets={initialAssets}
						isDefaultLocale={isDefaultLocale}
						isPublished={isPublished}
						person={person}
					/>
				</TabPanel>

				<TabPanel id="contributions" shouldPreserveState={true}>
					<ContributionsSection
						contributions={contributions}
						personDocumentId={documentId}
						roleOptions={contributionRoleOptions}
					/>
				</TabPanel>
			</EntityEditTabs>
		</Fragment>
	);
}
