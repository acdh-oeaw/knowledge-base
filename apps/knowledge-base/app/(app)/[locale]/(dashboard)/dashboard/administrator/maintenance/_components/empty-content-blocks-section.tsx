import type { ReactNode } from "react";

import { EmptyContentBlocksCleanup } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/empty-content-blocks-cleanup";
import { getEmptyContentBlocks } from "@/lib/data/content-block-cleanup";

export async function EmptyContentBlocksSection(): Promise<ReactNode> {
	const { blocks } = await getEmptyContentBlocks();

	return <EmptyContentBlocksCleanup blocks={blocks} />;
}
