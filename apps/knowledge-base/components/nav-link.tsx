"use client";

import { Link, type LinkProps } from "@dariah-eric/ui/link";
import type { ReactNode } from "react";

import { useNavLink } from "@/lib/navigation/use-nav-link";

export interface NavLinkProps extends LinkProps {
	href: string | undefined;
}

export function NavLink(props: Readonly<NavLinkProps>): ReactNode {
	const { children, ...rest } = props;

	const navLinkProps = useNavLink(rest);

	return (
		<Link {...rest} {...navLinkProps}>
			{children}
		</Link>
	);
}
