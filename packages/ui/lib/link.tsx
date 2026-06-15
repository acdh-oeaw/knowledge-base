"use client";

import { type ReactNode, use } from "react";
import { Link as AriaLink, type LinkProps as AriaLinkProps } from "react-aria-components";

import { cx } from "@/lib/primitive";
import { UiContext } from "@/lib/ui-provider";

export interface LinkProps extends AriaLinkProps {}

export function Link(props: Readonly<LinkProps>): ReactNode {
	const { children, className, ...rest } = props;

	const { LinkComponent = "a" } = use(UiContext);

	return (
		<AriaLink
			className={cx(
				[
					"font-medium text-(--text)",
					"outline-0 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring forced-colors:outline-[Highlight]",
					"disabled:cursor-default disabled:opacity-50 forced-colors:disabled:text-[GrayText]",
					"href" in props && "cursor-pointer",
				],
				className,
			)}
			render={(domProps, renderProps) => {
				if ("href" in domProps && domProps.href && !renderProps.isDisabled) {
					return <LinkComponent {...domProps} />;
				}

				return (
					<span
						{...domProps}
						// @ts-expect-error -- Link may be disabled but have `href`.
						href={undefined}
					/>
				);
			}}
			{...rest}
		>
			{children}
		</AriaLink>
	);
}
