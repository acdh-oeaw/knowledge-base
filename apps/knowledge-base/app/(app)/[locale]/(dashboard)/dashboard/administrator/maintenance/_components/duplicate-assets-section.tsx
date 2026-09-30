import type { ReactNode } from "react";

import { DuplicateAssets } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/duplicate-assets";
import { imageGridOptions } from "@/config/assets.config";
import { getDuplicateAssetGroups } from "@/lib/data/asset-deduplication";

export async function DuplicateAssetsSection(): Promise<ReactNode> {
	const groups = await getDuplicateAssetGroups({ imageUrlOptions: imageGridOptions });
	return <DuplicateAssets groups={groups} />;
}
