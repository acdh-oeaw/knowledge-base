import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { DefaultFooter } from "@/app/(app)/[locale]/(default)/_components/default-footer";
import { DefaultHeader } from "@/app/(app)/[locale]/(default)/_components/default-header";
import { mainContentId } from "@/app/(app)/[locale]/(default)/_components/main";
import { SkipLink } from "@/components/skip-link";

interface DefaultLayoutProps extends LayoutProps<"/[locale]"> {}

export default function DefaultLayout(props: Readonly<DefaultLayoutProps>): ReactNode {
	const { children } = props;

	const t = useExtracted();

	return (
		<Fragment>
			<SkipLink href={`#${mainContentId}`}>{t("Skip to main content")}</SkipLink>

			<div className="relative isolate flex min-block-full flex-col">
				<DefaultHeader />

				{children}

				<DefaultFooter />
			</div>
		</Fragment>
	);
}
