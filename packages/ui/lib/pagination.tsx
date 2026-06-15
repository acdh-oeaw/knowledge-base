"use client";

import { useExtracted } from "next-intl";
import { type ComponentProps, Fragment, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

import type { ButtonProps } from "@/lib/button";
import { buttonStyles } from "@/lib/button-styles";
import { Link, type LinkProps } from "@/lib/link";

export interface PaginationProps extends ComponentProps<"nav"> {}

export function Pagination(props: Readonly<PaginationProps>): ReactNode {
	const { className, ...rest } = props;

	const t = useExtracted("ui");

	return (
		<nav
			aria-label={t("Pagination")}
			className={twMerge(
				"mx-auto flex inline-full items-center justify-center gap-(--pagination-gap) [--pagination-gap:--spacing(2)] [--section-radius:calc(var(--radius-lg)-1px)] **:data-[slot=control]:inline-auto",
				"**:data-[slot=pagination-item]:cursor-default",
				className,
			)}
			data-slot="pagination"
			{...rest}
		/>
	);
}

export interface PaginationSectionProps extends ComponentProps<"ul"> {}

export function PaginationSection(props: Readonly<PaginationSectionProps>): ReactNode {
	const { className, ref, ...rest } = props;

	return (
		<li data-slot="pagination-section">
			<ul ref={ref} className={twMerge("flex block-full gap-1.5 text-sm/6", className)} {...rest} />
		</li>
	);
}

export interface PaginationListProps extends ComponentProps<"ul"> {}

export function PaginationList(props: Readonly<PaginationListProps>): ReactNode {
	const { className, ...rest } = props;

	const t = useExtracted("ui");

	return (
		<ul
			aria-label={props["aria-label"] ?? t("Pagination")}
			className={twMerge("flex gap-1.25", className)}
			data-slot="pagination-list"
			{...rest}
		/>
	);
}

interface PaginationItemProps
	extends Omit<LinkProps, "children">, Pick<ButtonProps, "isCircle" | "size" | "intent"> {
	className?: string;
	isCurrent?: boolean;
	children?: string | number;
	href?: string;
}

export function PaginationItem(props: Readonly<PaginationItemProps>): ReactNode {
	const { className, size = "sm", isCircle, isCurrent, ...rest } = props;

	return (
		<li>
			<Link
				aria-current={isCurrent === true ? "page" : undefined}
				className={buttonStyles({
					size,
					isCircle,
					intent: isCurrent === true ? "outline" : "plain",
					className: twMerge("touch-area min-inline-9 shrink-0", className),
				})}
				data-slot="pagination-item"
				href={isCurrent === true ? undefined : props.href}
				{...rest}
			/>
		</li>
	);
}

interface PaginationAttributesProps
	extends Omit<LinkProps, "className">, Pick<ButtonProps, "size" | "isCircle" | "intent"> {
	className?: string;
	children?: ReactNode;
}

export function PaginationFirst(props: Readonly<PaginationAttributesProps>): ReactNode {
	const { className, children, size = "sq-sm", intent = "outline", isCircle, ...rest } = props;

	const t = useExtracted("ui");

	return (
		<li>
			<Link
				aria-label={t("First page")}
				className={buttonStyles({
					size: children != null ? "sm" : size,
					isCircle,
					intent,
					className: twMerge("shrink-0", className),
				})}
				data-slot="pagination-item"
				{...rest}
			>
				<Fragment>
					<svg
						aria-hidden="true"
						data-slot="icon"
						fill="none"
						height={16}
						viewBox="0 0 25 24"
						width={16}
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="m17.5 18-6-6 6-6m-10 0v12"
							stroke="currentColor"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="1.5"
						/>
					</svg>
					{children}
				</Fragment>
			</Link>
		</li>
	);
}
export function PaginationPrevious(props: Readonly<PaginationAttributesProps>): ReactNode {
	const {
		className,
		children,
		size = "sq-sm",
		intent = "outline",
		isCircle = false,
		...rest
	} = props;

	const t = useExtracted("ui");

	return (
		<li>
			<Link
				aria-label={t("Previous page")}
				className={buttonStyles({
					size: children != null ? "sm" : size,
					isCircle,
					intent,
					className: twMerge("shrink-0", className),
				})}
				data-slot="pagination-item"
				{...rest}
			>
				<Fragment>
					<svg
						aria-hidden="true"
						data-slot="icon"
						fill="currentColor"
						viewBox="0 0 20 20"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							clipRule="evenodd"
							d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
							fillRule="evenodd"
						/>
					</svg>
					{children}
				</Fragment>
			</Link>
		</li>
	);
}

export function PaginationNext(props: Readonly<PaginationAttributesProps>): ReactNode {
	const {
		className,
		children,
		size = "sq-sm",
		intent = "outline",
		isCircle = false,
		...rest
	} = props;

	const t = useExtracted("ui");

	return (
		<li>
			<Link
				aria-label={t("Next page")}
				className={buttonStyles({
					size: children != null ? "sm" : size,
					isCircle,
					intent,
					className: twMerge("shrink-0", className),
				})}
				data-slot="pagination-item"
				{...rest}
			>
				<Fragment>
					{children}
					<svg
						aria-hidden="true"
						data-slot="icon"
						fill="currentColor"
						viewBox="0 0 20 20"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							clipRule="evenodd"
							d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
							fillRule="evenodd"
						/>
					</svg>
				</Fragment>
			</Link>
		</li>
	);
}

export function PaginationLast(props: Readonly<PaginationAttributesProps>): ReactNode {
	const {
		className,
		children,
		size = "sq-sm",
		intent = "outline",
		isCircle = false,
		...rest
	} = props;

	const t = useExtracted("ui");

	return (
		<li>
			<Link
				aria-label={t("Last page")}
				className={buttonStyles({
					size: children != null ? "sm" : size,
					isCircle,
					intent,
					className: twMerge("shrink-0", className),
				})}
				data-slot="pagination-item"
				{...rest}
			>
				<Fragment>
					{children}
					<svg
						aria-hidden="true"
						// eslint-disable-next-line better-tailwindcss/no-unknown-classes
						className="intentui-icons block-4 inline-4"
						data-slot="icon"
						fill="none"
						height={16}
						viewBox="0 0 25 24"
						width={16}
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="m7.5 18 6-6-6-6m10 0v12"
							stroke="currentColor"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="1.5"
						/>
					</svg>
				</Fragment>
			</Link>
		</li>
	);
}

export interface PaginationSpacerProps extends ComponentProps<"div"> {}

export function PaginationSpacer(props: Readonly<PaginationSpacerProps>): ReactNode {
	const { className, ...rest } = props;

	return <div aria-hidden={true} className={twMerge("flex-1", className)} {...rest} />;
}

export interface PaginationGapProps extends ComponentProps<"li"> {}

export function PaginationGap(props: Readonly<PaginationGapProps>): ReactNode {
	const { className, children, ...rest } = props;

	return (
		<li
			className={twMerge(
				"inline-9 select-none text-center font-semibold text-fg text-sm/6 outline-hidden",
				className,
			)}
			data-slot="pagination-gap"
			{...rest}
			aria-hidden={true}
		>
			{/* eslint-disable-next-line react/jsx-no-literals */}
			{children ?? <Fragment>&hellip;</Fragment>}
		</li>
	);
}

export interface PaginationLabelProps extends ComponentProps<"li"> {}

export function PaginationLabel(props: Readonly<PaginationLabelProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<li
			className={twMerge(
				"min-inline-4 self-center text-fg *:[strong]:font-medium *:[strong]:text-fg",
				className,
			)}
			data-slot="pagination-label"
			{...rest}
		/>
	);
}

export interface PaginationInfoProps extends ComponentProps<"p"> {}

export function PaginationInfo(props: Readonly<PaginationInfoProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<p
			className={twMerge(
				"text-muted-fg text-sm/6 *:[strong]:font-medium *:[strong]:text-fg",
				className,
			)}
			{...rest}
		/>
	);
}
