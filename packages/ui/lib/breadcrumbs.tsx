"use client";

import { ChevronRightIcon } from "@heroicons/react/24/solid";
import { Fragment, type ReactNode, createContext, use } from "react";
import {
	Breadcrumb,
	type BreadcrumbProps,
	Breadcrumbs as BreadcrumbsPrimitive,
	type BreadcrumbsProps,
	type LinkProps,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { cx } from "@/lib/primitive";

import { Link } from "./link";

interface BreadcrumbsContextProps {
	separator?: "chevron" | "slash" | boolean;
}
const BreadcrumbsProvider = createContext<BreadcrumbsContextProps>({
	separator: "chevron",
});

export function Breadcrumbs<T extends object>({
	className,
	...props
}: Readonly<BreadcrumbsProps<T> & BreadcrumbsContextProps>): ReactNode {
	return (
		<BreadcrumbsProvider value={{ separator: props.separator }}>
			<BreadcrumbsPrimitive {...props} className={twMerge("flex items-center gap-2", className)} />
		</BreadcrumbsProvider>
	);
}

export interface BreadcrumbsItemProps extends BreadcrumbProps, BreadcrumbsContextProps {
	href?: string;
}

export function BreadcrumbsItem({
	href,
	separator = true,
	className,
	...props
}: Readonly<BreadcrumbsItemProps & Partial<Omit<LinkProps, "className">>>): ReactNode {
	const { separator: contextSeparator } = use(BreadcrumbsProvider);
	const effectiveSeparator = contextSeparator ?? separator;
	const separatorValue = effectiveSeparator === true ? "chevron" : effectiveSeparator;

	return (
		<Breadcrumb
			className={cx("flex items-center gap-2 text-sm", className)}
			data-slot="breadcrumb-item"
			{...props}
		>
			{({ isCurrent }) => (
				<Fragment>
					{href != null ? (
						<Link href={href as string} {...props} />
					) : (
						<span className="cursor-default text-muted-fg">{props.children as ReactNode}</span>
					)}
					{!isCurrent && effectiveSeparator !== false && <Separator separator={separatorValue} />}
				</Fragment>
			)}
		</Breadcrumb>
	);
}

export function Separator({
	separator = "chevron",
}: Readonly<{
	separator?: BreadcrumbsItemProps["separator"];
}>): ReactNode {
	return (
		<span className="*:shrink-0 *:text-muted-fg *:data-[slot=icon]:block-3.5 *:data-[slot=icon]:inline-3.5">
			{separator === "chevron" && <ChevronRightIcon />}
			{separator === "slash" && <span className="text-muted-fg">/</span>}
		</span>
	);
}

Breadcrumbs.Item = BreadcrumbsItem;

export type { BreadcrumbsProps };
