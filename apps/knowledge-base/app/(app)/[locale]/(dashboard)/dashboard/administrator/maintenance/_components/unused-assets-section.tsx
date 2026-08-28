import type { ReactNode } from "react";

import { UnusedAssetsCleanup } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/unused-assets-cleanup";
import { imageGridOptions } from "@/config/assets.config";
import { getUnusedAssets } from "@/lib/data/asset-cleanup";

export async function UnusedAssetsSection(): Promise<ReactNode> {
	const { assets } = await getUnusedAssets({ imageUrlOptions: imageGridOptions });

	return <UnusedAssetsCleanup assets={assets} />;
}
