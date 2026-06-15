/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { generateImageUrl } from "@/lib/images";
import type { Database, Transaction } from "@/middlewares/db";
import { imageWidth } from "~/config/api.config";

export async function getSiteMetadata(db: Database | Transaction) {
	const item = await db.query.siteMetadata.findFirst({
		columns: {
			title: true,
			description: true,
			ogTitle: true,
			ogDescription: true,
		},
		with: {
			ogImage: {
				columns: {
					key: true,
					alt: true,
					caption: true,
				},
				with: {
					license: {
						columns: {
							name: true,
							url: true,
						},
					},
				},
			},
		},
	});

	if (item == null) {
		return null;
	}

	const ogImage = generateImageUrl(item.ogImage, imageWidth.featured);

	return { ...item, ogImage };
}
