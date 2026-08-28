import type { ReactNode } from "react";

import { LoadingDots } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/loading-dots";

export function LoadingScreen(): ReactNode {
	return (
		<div className="flex items-center justify-center min-block-56 sm:min-block-[75vh]">
			<LoadingDots size="large" />
		</div>
	);
}
