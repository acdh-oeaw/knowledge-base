import type { ReactNode } from "react";

import { LoadingDots } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/loading-dots";

export default function Loading(): ReactNode {
	return (
		<div className="flex grow items-center justify-center">
			<LoadingDots size="medium" />
		</div>
	);
}
