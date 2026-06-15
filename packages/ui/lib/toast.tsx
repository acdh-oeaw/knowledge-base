"use client";

import cn from "clsx/lite";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";
import {
	Button as AriaButton,
	Text as AriaText,
	UNSTABLE_Toast as AriaToast,
	UNSTABLE_ToastContent as AriaToastContent,
	type ToastProps as AriaToastProps,
	UNSTABLE_ToastQueue as AriaToastQueue,
	UNSTABLE_ToastRegion as AriaToastRegion,
	composeRenderProps,
} from "react-aria-components";
import { flushSync } from "react-dom";

export interface ToastContent {
	title: string;
	description?: string;
}

export const queue = new AriaToastQueue<ToastContent>({
	wrapUpdate(fn: () => void): void {
		if ("startViewTransition" in document) {
			document.startViewTransition(() => {
				// eslint-disable-next-line @eslint-react/dom/no-flush-sync
				flushSync(fn);
			});
		} else {
			fn();
		}
	},
});

export function ToastRegion(): ReactNode {
	const t = useExtracted("ui");

	return (
		<AriaToastRegion
			className="ui:fixed ui:inset-be-4 ui:inset-e-4 ui:flex ui:flex-col-reverse ui:gap-2 ui:rounded-lg ui:outline-none ui:focus-visible:outline-solid ui:focus-visible:outline-2 ui:focus-visible:outline-blue-600 ui:focus-visible:outline-offset-2"
			queue={queue}
		>
			{({ toast }) => (
				<Toast toast={toast}>
					<AriaToastContent className="ui:flex ui:flex-col ui:flex-1 ui:min-inline-0">
						<AriaText className="ui:font-semibold ui:text-white ui:text-sm" slot="title">
							{toast.content.title}
						</AriaText>
						{toast.content.description != null ? (
							<AriaText className="ui:text-xs ui:text-white" slot="description">
								{toast.content.description}
							</AriaText>
						) : null}
					</AriaToastContent>
					<AriaButton
						aria-label={t("Close")}
						className="ui:flex ui:flex-none ui:appearance-none ui:block-8 ui:inline-8 ui:rounded-sm ui:bg-transparent ui:border-none ui:text-white ui:p-0 ui:outline-none ui:items-center ui:justify-center ui:hover:bg-white/10 ui:pressed:bg-white/15 ui:focus-visible:outline-solid ui:focus-visible:outline-2 ui:focus-visible:outline-white ui:focus-visible:outline-offset-2"
						slot="close"
					>
						<XIcon className="block-4 inline-4" />
					</AriaButton>
				</Toast>
			)}
		</AriaToastRegion>
	);
}

export interface ToastProps extends AriaToastProps<ToastContent> {}

export function Toast(props: Readonly<ToastProps>): ReactNode {
	const { className, toast, ...rest } = props;

	return (
		<AriaToast
			{...rest}
			className={composeRenderProps(className, (className) =>
				cn(
					className,
					"ui:flex ui:items-center ui:gap-4 ui:bg-blue-600 ui:px-4 ui:py-3 ui:rounded-lg ui:outline-none ui:[view-transition-class:toast] ui:inline-57.5 ui:forced-colors:outline ui:focus-visible:outline-solid ui:focus-visible:outline-2 ui:focus-visible:outline-blue-600 ui:focus-visible:outline-offset-2",
				),
			)}
			style={{ viewTransitionName: toast.key }}
			toast={toast}
		/>
	);
}
