import cn from "clsx/lite";
import { useExtracted } from "next-intl";
import { connection } from "next/server";
import type { ComponentProps, ReactNode } from "react";

import { NavLink } from "@/app/(app)/[locale]/(default)/_components/nav-link";
import { ColorSchemeToggle } from "@/app/(app)/[locale]/_components/color-scheme-toggle";
import { Logo } from "@/components/logo";
import { useMetadata } from "@/lib/i18n/metadata";
import { createHref } from "@/lib/navigation/create-href";
import type { NavigationLink } from "@/lib/navigation/navigation";
import { config as socialMediaConfig } from "@/lib/social-media/social-media.config";

interface DefaultFooterProps extends ComponentProps<"footer"> {}

export function DefaultFooter(props: Readonly<DefaultFooterProps>): ReactNode {
	const { className, ...rest } = props;

	const t = useExtracted();
	const meta = useMetadata();

	const links = {
		home: {
			type: "link",
			href: createHref({ pathname: "/" }),
			label: t("Home"),
		},
		contact: {
			type: "link",
			href: createHref({ pathname: "/contact" }),
			label: t("Contact"),
		},
		"privacy-policy": {
			type: "link",
			href: createHref({ pathname: "/privacy-policy" }),
			label: t("Privacy policy"),
		},
		"terms-of-use": {
			type: "link",
			href: createHref({ pathname: "/terms-of-use" }),
			label: t("Terms of use"),
		},
		imprint: {
			type: "link",
			href: createHref({ pathname: "/imprint" }),
			label: t("Imprint"),
		},
	} satisfies Record<string, NavigationLink>;

	return (
		<footer {...rest} className={cn("border-bs border-stroke-weak", className)}>
			<div className="container flex flex-col gap-y-6 px-8 py-12 sm:px-16">
				<div className="flex flex-col gap-y-8 sm:flex-row sm:items-center sm:justify-between">
					<NavLink className="me-auto -ms-1" href={links.home.href} size="icon">
						<span className="sr-only">{links.home.label}</span>
						<Logo className="block-8 inline-auto" />
					</NavLink>

					<nav aria-label={t("Social media")}>
						<ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
							{Object.values(meta.social).map((social) => {
								const { href, kind, label } = social;

								if (kind === "email" || kind === "website") {
									return null;
								}

								const Icon = socialMediaConfig[kind].icon;

								return (
									<li key={kind} className="inline-flex shrink-0">
										<NavLink href={href} size="icon">
											<span className="sr-only">{label}</span>
											<Icon aria-hidden={true} className="block-6 inline-6" />
										</NavLink>
									</li>
								);
							})}
						</ul>
					</nav>
				</div>

				<div className="flex flex-col gap-y-6">
					<div className="flex flex-col gap-y-4 sm:flex-row sm:items-center sm:justify-between sm:gap-x-6">
						<nav aria-label={t("Secondary")}>
							<ul className="-mx-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
								{Object.entries(links).map(([id, link]) => {
									if (id === "home") {
										return null;
									}

									return (
										<li key={id}>
											<NavLink href={link.href} size="md">
												{link.label}
											</NavLink>
										</li>
									);
								})}
							</ul>
						</nav>

						<div className="self-start">
							<ColorSchemeToggle />
						</div>
					</div>

					<small className="text-xs text-text-weak">
						&copy; <CurrentYear />{" "}
						{/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
						{meta.social.website != null ? (
							<NavLink href={meta.social.website.href} size="sm">
								{meta.creator}
							</NavLink>
						) : (
							meta.creator
						)}
					</small>
				</div>
			</div>
		</footer>
	);
}

async function CurrentYear() {
	// "use cache";

	/** Ensure `new Date()` is computed at request time. */
	await connection();

	return new Date().getUTCFullYear();
}
