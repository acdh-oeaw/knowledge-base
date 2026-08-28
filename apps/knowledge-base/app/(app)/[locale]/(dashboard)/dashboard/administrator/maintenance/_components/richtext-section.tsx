import type { ReactNode } from "react";

import { RichTextCleanup } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/richtext-cleanup";
import { getRichTextNeedingCleanup } from "@/lib/data/richtext-cleanup";

export async function RichTextSection(): Promise<ReactNode> {
	const { blocks } = await getRichTextNeedingCleanup();

	return <RichTextCleanup blocks={blocks} />;
}
