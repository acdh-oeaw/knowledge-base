import type { ReactNode } from "react";

import { UnusedSocialMediaCleanup } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/unused-social-media-cleanup";
import { getUnusedSocialMedia } from "@/lib/data/social-media-cleanup";

export async function UnusedSocialMediaSection(): Promise<ReactNode> {
	const { items } = await getUnusedSocialMedia();

	return <UnusedSocialMediaCleanup items={items} />;
}
