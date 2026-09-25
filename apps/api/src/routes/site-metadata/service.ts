/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { generateImageUrl, imageAssetColumns } from "@/lib/images";
import { resolveLocaleContext } from "@/lib/locales";
import type { Database, Transaction } from "@/middlewares/db";
import { imageWidth } from "~/config/api.config";

const translationColumns = {
	columns: {
		title: true,
		description: true,
		ogTitle: true,
		ogDescription: true,
	},
	with: {
		ogImage: imageAssetColumns,
	},
} as const;

async function getSiteMetadataTranslation(db: Database | Transaction, localeId: string) {
	return db.query.siteMetadataTranslations.findFirst({
		where: { localeId },
		...translationColumns,
	});
}

export interface GetSiteMetadataParams {
	localeId?: string;
}

export async function getSiteMetadata(
	db: Database | Transaction,
	params: GetSiteMetadataParams = {},
) {
	const { localeId, defaultLocaleId } = await resolveLocaleContext(db, params.localeId);

	const item =
		(await getSiteMetadataTranslation(db, localeId)) ??
		(localeId !== defaultLocaleId ? await getSiteMetadataTranslation(db, defaultLocaleId) : null);

	if (item == null) {
		return null;
	}

	const ogImage = generateImageUrl(item.ogImage, imageWidth.featured);

	return { ...item, ogImage };
}
