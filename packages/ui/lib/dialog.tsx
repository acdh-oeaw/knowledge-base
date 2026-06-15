"use client";

import { XMarkIcon } from "@heroicons/react/24/solid";
import { useExtracted } from "next-intl";
import type { ComponentProps, ReactNode, Ref } from "react";
import {
	Button as AriaButton,
	Dialog as AriaDialog,
	Heading as AriaHeading,
	type HeadingProps,
	type TextProps,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { cx } from "@/lib/primitive";

import { Button, type ButtonProps } from "./button";

export function Dialog({
	role = "dialog",
	className,
	...props
}: Readonly<ComponentProps<typeof AriaDialog>>): ReactNode {
	return (
		<AriaDialog
			className={twMerge(
				"peer/dialog group/dialog relative flex max-block-[calc(var(--visual-viewport-height)-var(--visual-viewport-vertical-padding))] flex-col overflow-hidden outline-hidden [--gutter:--spacing(6)] sm:[--gutter:--spacing(8)]",
				className,
			)}
			data-slot="dialog"
			role={role}
			{...props}
		/>
	);
}

export function DialogTrigger({ className, ...props }: Readonly<ButtonProps>): ReactNode {
	return <AriaButton className={cx("cursor-pointer", className)} {...props} />;
}

export interface DialogHeaderProps extends Omit<ComponentProps<"div">, "title"> {
	title?: string;
	description?: string;
}

export function DialogHeader({ className, ...props }: Readonly<DialogHeaderProps>): ReactNode {
	return (
		<div
			className={twMerge(
				"relative space-y-1 p-(--gutter) pbe-[calc(var(--gutter)-(--spacing(3)))]",
				className,
			)}
			data-slot="dialog-header"
		>
			{props.title != null ? <DialogTitle>{props.title}</DialogTitle> : null}
			{props.description != null ? (
				<DialogDescription>{props.description}</DialogDescription>
			) : null}
			{props.title != null && typeof props.children === "string" ? (
				<DialogTitle>{props.children}</DialogTitle>
			) : (
				props.children
			)}
		</div>
	);
}

export interface DialogTitleProps extends HeadingProps {
	ref?: Ref<HTMLHeadingElement>;
}
export function DialogTitle({ className, ref, ...props }: Readonly<DialogTitleProps>): ReactNode {
	return (
		<AriaHeading
			ref={ref}
			className={twMerge("text-balance font-semibold text-fg text-lg/6 sm:text-base/6", className)}
			slot="title"
			{...props}
		/>
	);
}

export interface DialogDescriptionProps extends TextProps {
	ref?: Ref<HTMLDivElement>;
}
export function DialogDescription({
	className,
	ref,
	...props
}: Readonly<DialogDescriptionProps>): ReactNode {
	return (
		<p
			ref={ref}
			className={twMerge(
				"text-pretty text-base/6 text-muted-fg group-disabled:opacity-50 sm:text-sm/6",
				className,
			)}
			data-slot="description"
			{...props}
		/>
	);
}

export interface DialogBodyProps extends ComponentProps<"div"> {}
export function DialogBody({ className, ...props }: Readonly<DialogBodyProps>): ReactNode {
	return (
		<div
			className={twMerge(
				"isolate flex min-block-0 flex-1 flex-col overflow-auto px-(--gutter) py-1",
				"**:data-[slot=dialog-footer]:px-0 **:data-[slot=dialog-footer]:pbs-0",
				className,
			)}
			data-slot="dialog-body"
			{...props}
		/>
	);
}

export interface DialogFooterProps extends ComponentProps<"div"> {}
export function DialogFooter({ className, ...props }: Readonly<DialogFooterProps>): ReactNode {
	return (
		<div
			className={twMerge(
				"isolate mbs-auto flex flex-col-reverse justify-end gap-3 p-(--gutter) pbs-[calc(var(--gutter)-(--spacing(2)))] sm:flex-row group-not-has-data-[slot=dialog-body]/dialog:pbs-0 group-not-has-data-[slot=dialog-body]/popover:pbs-0",
				className,
			)}
			data-slot="dialog-footer"
			{...props}
		/>
	);
}

export function DialogClose({ intent = "plain", ref, ...props }: Readonly<ButtonProps>): ReactNode {
	return <Button ref={ref} intent={intent} slot="close" {...props} />;
}

export interface CloseButtonIndicatorProps extends Omit<ButtonProps, "children"> {
	className?: string;
	isDismissable?: boolean | undefined;
}

export function DialogCloseIcon({
	className,
	...props
}: Readonly<CloseButtonIndicatorProps>): ReactNode {
	const t = useExtracted("ui");

	return props.isDismissable != null ? (
		<AriaButton
			aria-label={t("Close")}
			className={cx(
				"absolute inset-e-1 inset-bs-1 z-50 grid block-8 inline-8 place-content-center rounded-xl hover:bg-secondary focus:bg-secondary focus:outline-hidden focus-visible:ring-1 focus-visible:ring-primary sm:inset-bs-2 sm:block-7 sm:inline-7 sm:rounded-md",
				className,
			)}
			slot="close"
		>
			<XMarkIcon className="block-4 inline-4" />
		</AriaButton>
	) : null;
}
