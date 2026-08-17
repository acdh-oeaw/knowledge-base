import { Heading } from "@dariah-eric/ui/heading";
import { getExtracted } from "next-intl/server";
import { Fragment, type ReactNode } from "react";

import {
	Header,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import { assertAuthenticated } from "@/lib/auth/session";

export default async function DashboardPage(): Promise<ReactNode> {
	const { user } = await assertAuthenticated();

	const t = await getExtracted();

	return (
		<Fragment>
			<Heading>{t("Welcome, {name}", { name: user.name })}</Heading>
			<Header className="my-(--layout-gutter) border-bs">
				<HeaderContent>
					<HeaderTitle>{t("Lorem ipsum")}</HeaderTitle>
					<HeaderDescription>
						{t(
							"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
						)}
					</HeaderDescription>
				</HeaderContent>
			</Header>
			<div className="grid grid-cols-1 gap-2 md:grid-cols-2"></div>
		</Fragment>
	);
}
