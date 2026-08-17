import { Link } from "@dariah-eric/ui/link";
import cn from "clsx/lite";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import type { ComponentProps, ReactNode } from "react";

// import { LocaleSelect } from "@/app/(app)/[locale]/_components/locale-select";
import { Navigation } from "@/app/(app)/[locale]/(default)/_components/navigation";
import { UserMenu } from "@/app/(app)/[locale]/(default)/_components/user-menu";
import { getCurrentSession } from "@/lib/auth/session";
import { createHref } from "@/lib/navigation/create-href";
import type { NavigationConfig } from "@/lib/navigation/navigation";

interface DefaultHeaderProps extends ComponentProps<"header"> {}

export function DefaultHeader(props: Readonly<DefaultHeaderProps>): ReactNode {
	const { className, ...rest } = props;

	const t = useExtracted();

	const navigation = {
		home: {
			type: "link",
			href: createHref({ pathname: "/" }),
			label: t("Home"),
		},
	} satisfies NavigationConfig;

	return (
		<header {...rest} className={cn("border-be border-stroke-weak", className)}>
			<div className="container flex items-center justify-between gap-x-12 px-8 py-4 sm:px-16">
				<Navigation label={t("Main")} navigation={navigation} />

				<div className="flex items-center gap-x-6 ms-auto">
					{/* <LocaleSelect /> */}
					<User />
				</div>
			</div>
		</header>
	);
}

async function User(): Promise<ReactNode> {
	const { session, user } = await getCurrentSession();

	const t = await getExtracted();

	if (session == null) {
		return (
			<div>
				<Link className="whitespace-nowrap" href="/auth/sign-in">
					{t("Sign in")}
				</Link>
			</div>
		);
	}

	return (
		<div>
			<UserMenu user={user} />
		</div>
	);
}
