"use client";

import { Fragment, type ReactNode } from "react";
import {
	type DialogProps as AriaDialogProps,
	DialogTrigger as AriaDialogTrigger,
	type DialogTriggerProps as AriaDialogTriggerProps,
	Modal as AriaModal,
	ModalOverlay as AriaModalOverlay,
	type ModalOverlayProps as AriaModalOverlayProps,
} from "react-aria-components";
import { twJoin } from "tailwind-merge";

import {
	Dialog,
	DialogBody,
	DialogClose,
	DialogCloseIcon,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/lib/dialog";
import { cx } from "@/lib/primitive";

export interface ModalProps extends AriaDialogTriggerProps {}

export function Modal(props: Readonly<ModalProps>): ReactNode {
	return <AriaDialogTrigger {...props} />;
}

const sizes = {
	"2xs": "sm:max-w-2xs",
	xs: "sm:max-w-xs",
	sm: "sm:max-w-sm",
	md: "sm:max-w-md",
	lg: "sm:max-w-lg",
	xl: "sm:max-w-xl",
	"2xl": "sm:max-w-2xl",
	"3xl": "sm:max-w-3xl",
	"4xl": "sm:max-w-4xl",
	"5xl": "sm:max-w-5xl",
	fullscreen: "",
};

export interface ModalContentProps
	extends
		Omit<AriaModalOverlayProps, "className" | "children">,
		Pick<AriaDialogProps, "aria-label" | "aria-labelledby" | "role" | "children"> {
	size?: keyof typeof sizes;
	closeButton?: boolean;
	isBlurred?: boolean;
	className?: AriaModalOverlayProps["className"];
	overlay?: Omit<AriaModalOverlayProps, "children">;
}

export function ModalContent(props: Readonly<ModalContentProps>): ReactNode {
	const {
		className,
		isDismissable: isDismissableInternal,
		isBlurred = false,
		children,
		overlay: _,
		size = "lg",
		role = "dialog",
		closeButton = true,
		...rest
	} = props;

	const isDismissable = isDismissableInternal ?? role !== "alertdialog";

	return (
		<AriaModalOverlay
			className={twJoin(
				"fixed inset-0 z-50 block-(--visual-viewport-height,100vh) bg-black/15",
				"grid grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr]",
				size === "fullscreen" ? "md:p-3" : "md:p-4",
				"entering:fade-in entering:animate-in entering:duration-300 entering:ease-out",
				"exiting:fade-out exiting:animate-out exiting:ease-in",
				isBlurred && "backdrop-blur-[1px]",
			)}
			data-slot="modal-overlay"
			isDismissable={isDismissable}
			{...rest}
		>
			<AriaModal
				className={cx(
					"row-start-2 inline-full text-start align-middle",
					"[--visual-viewport-vertical-padding:16px]",
					size === "fullscreen"
						? "sm:rounded-md sm:[--visual-viewport-vertical-padding:16px]"
						: "sm:rounded-xl sm:[--visual-viewport-vertical-padding:32px]",
					"relative overflow-hidden bg-overlay text-overlay-fg",
					"rounded-t-2xl shadow-lg ring ring-fg/5 dark:ring-border",
					sizes[size],

					"entering:slide-in-from-bottom entering:animate-in entering:duration-300 entering:ease-out sm:entering:zoom-in-95 sm:entering:slide-in-from-bottom-0",
					"exiting:slide-out-to-bottom exiting:animate-out exiting:ease-in sm:exiting:zoom-out-95 sm:exiting:slide-out-to-bottom-0",
					className,
				)}
				data-slot="modal-content"
				{...props}
			>
				<Dialog role={role}>
					{(values) => (
						<Fragment>
							{typeof children === "function" ? children(values) : children}
							{closeButton && <DialogCloseIcon isDismissable={isDismissable} />}
						</Fragment>
					)}
				</Dialog>
			</AriaModal>
		</AriaModalOverlay>
	);
}

export const ModalTrigger = DialogTrigger;
export const ModalHeader = DialogHeader;
export const ModalTitle = DialogTitle;
export const ModalDescription = DialogDescription;
export const ModalFooter = DialogFooter;
export const ModalBody = DialogBody;
export const ModalClose = DialogClose;
