"use client";

import type * as schema from "@dariah-eric/database/schema";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@dariah-eric/ui/description-list";
import { Note } from "@dariah-eric/ui/note";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { ContentBlocksView } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks-view";
import { EntityLifecycleBar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-bar";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { VersionSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/version-selector";

interface DocumentOrPolicyDetailsProps {
	contentBlocks: Array<ContentBlock>;
	documentId: string;
	hasDraft: boolean;
	isLocaleFallback: boolean;
	isPublished: boolean;
	locales: Array<{ code: string; name: string }>;
	selectedLocaleCode: string;
	selectedVersion: "draft" | "published";
	documentOrPolicy: Pick<schema.DocumentOrPolicy, "id" | "title" | "summary" | "url"> & {
		entityVersion: {
			entity: { id: string };
			slug: { value: string };
		};
	} & { document: { key: string; label: string; url: string; downloadUrl: string } };
	publishAction: (documentId: string) => Promise<void>;
	discardDraftAction?: (documentId: string) => Promise<void>;
}

export function DocumentOrPolicyDetails(props: Readonly<DocumentOrPolicyDetailsProps>): ReactNode {
	const {
		contentBlocks,
		documentId,
		hasDraft,
		isLocaleFallback,
		isPublished,
		locales,
		selectedLocaleCode,
		documentOrPolicy,
		publishAction,
		discardDraftAction,
		selectedVersion,
	} = props;

	const t = useExtracted();

	return (
		<Fragment>
			{isLocaleFallback ? (
				<Note intent="info">
					{t("Not yet translated in the selected language — showing the default language.")}
				</Note>
			) : null}
			<div className="flex items-center justify-between">
				<VersionSelector
					draftHref={`/dashboard/website/documents-policies/${documentOrPolicy.entityVersion.slug.value}/details`}
					hasDraft={hasDraft}
					isPublished={isPublished}
					publishedHref={`/dashboard/website/documents-policies/${documentOrPolicy.entityVersion.slug.value}/details?version=published`}
					selectedVersion={selectedVersion}
				/>
				<div className="flex items-center gap-x-4">
					<EntityLifecycleBar
						discardDraftAction={discardDraftAction}
						documentId={documentId}
						editHref={`/dashboard/website/documents-policies/${documentOrPolicy.entityVersion.slug.value}/edit`}
						hasDraft={hasDraft}
						isPublished={isPublished}
						publishAction={publishAction}
					/>
					<LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
				</div>
			</div>
			<DescriptionList>
				<DescriptionTerm>{t("Title")}</DescriptionTerm>
				<DescriptionDetails>{documentOrPolicy.title}</DescriptionDetails>

				<DescriptionTerm>{t("Slug")}</DescriptionTerm>
				<DescriptionDetails>{documentOrPolicy.entityVersion.slug.value}</DescriptionDetails>

				<DescriptionTerm>{t("Summary")}</DescriptionTerm>
				<DescriptionDetails>{documentOrPolicy.summary}</DescriptionDetails>

				{documentOrPolicy.url != null ? (
					<>
						<DescriptionTerm>{t("URL")}</DescriptionTerm>
						<DescriptionDetails>{documentOrPolicy.url}</DescriptionDetails>
					</>
				) : null}

				<DescriptionTerm>{t("Document")}</DescriptionTerm>
				<DescriptionDetails>
					<a
						className="underline"
						download={documentOrPolicy.document.label}
						href={documentOrPolicy.document.downloadUrl}
					>
						{documentOrPolicy.document.label}
					</a>
				</DescriptionDetails>

				<DescriptionTerm>{t("Content")}</DescriptionTerm>
				<DescriptionDetails>
					<ContentBlocksView contentBlocks={contentBlocks} />
				</DescriptionDetails>
			</DescriptionList>
		</Fragment>
	);
}
