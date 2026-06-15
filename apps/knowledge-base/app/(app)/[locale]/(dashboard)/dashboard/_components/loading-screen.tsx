import type { ReactNode } from "react";

import { LoadingDots } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/loading-dots";

export function LoadingScreen(): ReactNode {
	return (
		<div className="flex min-block-56 items-center justify-center sm:min-block-[75vh]">
			<LoadingDots size="large" />
		</div>
	);
}
