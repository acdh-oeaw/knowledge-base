"use client";

import { Fragment, type ReactNode } from "react";
import {
	DialogTrigger as AriaDialogTrigger,
	Modal as AriaModal,
	ModalOverlay as AriaModalOverlay,
	type DialogProps,
	type ModalOverlayProps,
} from "react-aria-components";

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

export const Sheet = AriaDialogTrigger;

export interface SheetContentProps
	extends
		Omit<ModalOverlayProps, "children">,
		Pick<DialogProps, "aria-label" | "role" | "aria-labelledby" | "children"> {
	closeButton?: boolean;
	isFloat?: boolean;
	side?: "top" | "bottom" | "left" | "right";
	overlay?: Omit<ModalOverlayProps, "children">;
}

const sideVariants: Record<string, string> = {
	top: "entering:slide-in-from-top exiting:slide-out-to-top inset-x-0 top-0 rounded-b-2xl border-b data-[float=true]:inset-x-2 data-[float=true]:top-2 data-[float=true]:border-b-0",
	bottom:
		"entering:slide-in-from-bottom exiting:slide-out-to-bottom inset-x-0 bottom-0 rounded-t-2xl border-t data-[float=true]:inset-x-2 data-[float=true]:bottom-2 data-[float=true]:border-t-0",
	left: "entering:slide-in-from-left exiting:slide-out-to-left-80 inset-y-0 left-0 h-auto w-3/4 overflow-y-auto border-r sm:max-w-80 data-[float=true]:inset-y-2 data-[float=true]:left-2 data-[float=true]:border-r-0",
	right:
		"entering:slide-in-from-right exiting:slide-out-to-right-80 inset-y-0 right-0 h-auto w-3/4 overflow-y-auto border-l sm:max-w-80 data-[float=true]:inset-y-2 data-[float=true]:right-2 data-[float=true]:border-l-0",
};

export function SheetContent({
	className,
	isDismissable: isDismissableInternal,
	side = "right",
	role = "dialog",
	closeButton = true,
	isFloat = true,
	overlay: _,
	children,
	...props
}: Readonly<SheetContentProps>): ReactNode {
	const isDismissable = isDismissableInternal ?? role !== "alertdialog";
	return (
		<AriaModalOverlay
			className="fixed inset-s-0 inset-bs-0 z-50 block-full inline-full overflow-hidden bg-black/15 entering:fade-in entering:animate-in entering:duration-500 exiting:fade-out exiting:animate-out exiting:duration-300"
			isDismissable={isDismissable}
			{...props}
		>
			<AriaModal
				className={cx(
					"fixed z-50 grid gap-4 border-muted-fg/20 bg-overlay text-overlay-fg shadow-lg dark:border-border",
					"transform-gpu transition ease-in-out will-change-transform [--visual-viewport-vertical-padding:16px]",
					"dark:data-[float=true]:ring-border data-[float=true]:rounded-lg data-[float=true]:ring data-[float=true]:ring-fg/5",
					"border-fg/20 dark:border-border",
					"entering:fade-in entering:animate-in entering:duration-500",
					"exiting:fade-in exiting:animate-out exiting:duration-300",
					sideVariants[side],
					className,
				)}
				data-float={isFloat}
			>
				<Dialog aria-label={props["aria-label"]} className="sm:[--gutter:--spacing(6)]" role={role}>
					{(values) => (
						<Fragment>
							{typeof children === "function" ? children(values) : children}
							{closeButton && (
								<DialogCloseIcon
									className="inset-e-2.5 inset-bs-2.5"
									isDismissable={isDismissable}
								/>
							)}
						</Fragment>
					)}
				</Dialog>
			</AriaModal>
		</AriaModalOverlay>
	);
}

export const SheetTrigger = DialogTrigger;
export const SheetFooter = DialogFooter;
export const SheetHeader = DialogHeader;
export const SheetTitle = DialogTitle;
export const SheetDescription = DialogDescription;
export const SheetBody = DialogBody;
export const SheetClose = DialogClose;
