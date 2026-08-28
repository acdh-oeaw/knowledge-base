import type { ReactNode } from "react";

import { LoadingDots } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/loading-dots";

export function MaintenanceSectionFallback(): ReactNode {
	return (
		<div className="flex justify-center py-8">
			<LoadingDots size="medium" />
		</div>
	);
}
