"use client";

import { ChevronRightIcon } from "@heroicons/react/24/solid";
import { useExtracted } from "next-intl";
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
	const t = useExtracted("ui");

	return (
		<BreadcrumbsProvider value={{ separator: props.separator }}>
			{/* Breadcrumbs render an `ol`, so they need a navigation landmark of their own. */}
			<nav aria-label={t("Breadcrumbs")} className="flex min-inline-0" data-slot="breadcrumbs">
				<BreadcrumbsPrimitive
					{...props}
					className={twMerge("flex items-center gap-2 min-inline-0", className)}
				/>
			</nav>
		</BreadcrumbsProvider>
	);
}

export interface BreadcrumbsItemProps extends BreadcrumbProps, BreadcrumbsContextProps {
	href?: string;
	/**
	 * Allow the label to shrink and be truncated with an ellipsis when horizontal space runs out.
	 * Items are never wrapped, so this should be set on items with arbitrary-length labels (e.g.
	 * entity names), while items with short, known labels keep their intrinsic size.
	 */
	isTruncated?: boolean;
}

export function BreadcrumbsItem({
	href,
	isTruncated = false,
	separator = true,
	className,
	...props
}: Readonly<BreadcrumbsItemProps & Partial<Omit<LinkProps, "className">>>): ReactNode {
	const { separator: contextSeparator } = use(BreadcrumbsProvider);
	const effectiveSeparator = contextSeparator ?? separator;
	const separatorValue = effectiveSeparator === true ? "chevron" : effectiveSeparator;

	return (
		<Breadcrumb
			className={cx(
				"flex items-center gap-2 text-sm whitespace-nowrap",
				isTruncated ? "shrink min-inline-0" : "shrink-0",
				className,
			)}
			data-slot="breadcrumb-item"
			{...props}
		>
			{({ isCurrent }) => (
				<Fragment>
					{href != null ? (
						<Link
							{...props}
							className={isTruncated ? "truncate min-inline-0" : undefined}
							href={href as string}
						/>
					) : (
						<span
							className={twMerge(
								"cursor-default text-muted-fg",
								isTruncated && "truncate min-inline-0",
							)}
							data-slot="breadcrumb-label"
						>
							{props.children as ReactNode}
						</span>
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
