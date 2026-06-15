import type { ReactNode } from "react";

import { assertAuthenticated } from "@/lib/auth/session";

interface ReportingLayoutProps extends LayoutProps<"/[locale]/dashboard/reporting"> {}

export default async function ReportingLayout(
	props: Readonly<ReportingLayoutProps>,
): Promise<ReactNode> {
	const { children } = props;

	await assertAuthenticated();

	return children;
}
