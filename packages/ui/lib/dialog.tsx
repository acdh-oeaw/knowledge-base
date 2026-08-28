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
				"peer/dialog group/dialog relative flex flex-col overflow-hidden outline-hidden [--gutter:--spacing(6)] max-block-[calc(var(--visual-viewport-height)-var(--visual-viewport-vertical-padding))] sm:[--gutter:--spacing(8)]",
				/**
				 * Dialogs that submit a form wrap header, body and footer in one — so the column that caps
				 * at the viewport height is the dialog, but the element actually holding the three regions
				 * is the form. Left as a plain block it sizes to its content, overflows the capped dialog,
				 * and is clipped by `overflow-hidden`: the body's `overflow-auto` never gets a constrained
				 * height to scroll within, and the footer's buttons end up below the viewport with no way
				 * to reach them. Handing the form the same column layout puts the regions back under the
				 * cap.
				 */
				"[&>form]:flex [&>form]:flex-1 [&>form]:flex-col [&>form]:min-block-0",
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
			className={twMerge("text-lg/6 font-semibold text-balance text-fg sm:text-base/6", className)}
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
				"text-base/6 text-pretty text-muted-fg group-disabled:opacity-50 sm:text-sm/6",
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
				"isolate flex flex-1 flex-col overflow-auto px-(--gutter) py-1 min-block-0",
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
				"absolute inset-e-1 inset-bs-1 z-50 grid place-content-center rounded-xl block-8 inline-8 hover:bg-secondary focus:bg-secondary focus:outline-hidden focus-visible:ring-1 focus-visible:ring-primary sm:inset-bs-2 sm:rounded-md sm:block-7 sm:inline-7",
				className,
			)}
			slot="close"
		>
			<XMarkIcon className="block-4 inline-4" />
		</AriaButton>
	) : null;
}
