import { assert } from "@acdh-oeaw/lib";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { WorkingGroupDetails } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-groups/_components/working-group-details";
import { imageGridOptions } from "@/config/assets.config";
import { assertCan } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";
import { resolvePlaceholderValuesInContentBlocks } from "@/lib/content-blocks-service";
import { getOrganisationalUnitEditData } from "@/lib/data/admin-organisational-units";
import { resolveLocalizedDetailVersion } from "@/lib/data/entity-detail-view";
import { getLocales } from "@/lib/data/locales";
import { getPersonRelations } from "@/lib/data/person-relations";
import { getUserOrganisationalUnitScopes } from "@/lib/data/user-organisational-units";
import { images } from "@/lib/images";
import { createMetadata } from "@/lib/server/create-metadata";

interface WorkingGroupPageProps extends PageProps<"/[locale]/dashboard/working-groups/[slug]"> {}

export async function generateMetadata(
	_props: Readonly<WorkingGroupPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();
	return createMetadata(resolvingMetadata, { title: t("Working group") });
}

export default async function WorkingGroupPage(
	props: Readonly<WorkingGroupPageProps>,
): Promise<ReactNode> {
	const [{ slug }, searchParams, { user }] = await Promise.all([
		props.params,
		props.searchParams,
		assertAuthenticated(),
	]);
	const t = await getExtracted();
	const scopes = await getUserOrganisationalUnitScopes(user);
	const workingGroup = scopes.workingGroups.find((item) => item.slug === slug);
	if (workingGroup == null) {
		notFound();
	}

	await assertCan(user, "read", { type: "organisational_unit", id: workingGroup.documentId });
	const requestedVersion = workingGroup.canEdit ? searchParams.version : "published";

	const locales = await getLocales();
	const requestedLocale = locales.find((locale) => locale.code === searchParams.locale);
	const selectedLocale =
		requestedLocale ?? locales.find((locale) => locale.isDefault) ?? locales[0];

	if (selectedLocale == null) {
		notFound();
	}

	const localizedVersion = await resolveLocalizedDetailVersion(
		workingGroup.documentId,
		requestedVersion,
		locales,
		selectedLocale.id,
	);

	if (localizedVersion == null) {
		return (
			<Fragment>
				<div className="flex items-center justify-between">
					<LocaleSelector locales={locales} selectedLocaleCode={selectedLocale.code} />
				</div>
				<p className="text-sm text-muted-fg italic">
					{t("This document has no content in the selected locale yet.")}
				</p>
			</Fragment>
		);
	}

	if (!workingGroup.canEdit && localizedVersion.publishedId == null) {
		notFound();
	}

	const {
		displayLocaleId,
		hasDraftChanges,
		isLocaleFallback,
		publishedId,
		selectedVersion,
		versionId,
	} = localizedVersion;

	const [data, personRelations] = await Promise.all([
		getOrganisationalUnitEditData({
			slug,
			unitType: "working_group",
			versionId,
			publishedVersionId: publishedId,
			localeId: displayLocaleId,
		}),
		getPersonRelations(workingGroup.documentId),
	]);
	if (data == null) {
		notFound();
	}

	const image =
		data.unit.image == null
			? null
			: {
					...data.unit.image,
					url: images.generateSignedImageUrl({
						key: data.unit.image.key,
						options: imageGridOptions,
					}).url,
				};
	const detailHref = `/dashboard/working-groups/${slug}`;

	assert(
		data.unit.entityVersion.slug,
		`Slug missing for entity version "${data.unit.entityVersion.id}".`,
	);
	const entityVersionSlug = data.unit.entityVersion.slug;
	const descriptionContentBlocks = await resolvePlaceholderValuesInContentBlocks(
		data.unit.descriptionContentBlocks,
	);

	return (
		<WorkingGroupDetails
			detailHref={detailHref}
			documentId={workingGroup.documentId}
			editHref={workingGroup.canEdit ? `${detailHref}/edit` : null}
			enableAdminEntityLinks={false}
			hasDraft={workingGroup.canEdit && hasDraftChanges}
			isLocaleFallback={isLocaleFallback}
			isPublished={publishedId != null}
			locales={locales}
			selectedLocaleCode={selectedLocale.code}
			personRelations={personRelations}
			relations={data.relations}
			selectedRelatedEntities={data.selectedRelatedEntities}
			selectedRelatedResources={data.selectedRelatedResources}
			selectedSocialMediaItems={data.selectedSocialMediaItems}
			selectedVersion={selectedVersion}
			workingGroup={{
				...data.unit,
				entityVersion: { ...data.unit.entityVersion, slug: entityVersionSlug },
				descriptionContentBlocks,
				image,
			}}
		/>
	);
}
