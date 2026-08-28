"use client";

import type { ComponentType, ReactNode } from "react";
import { Button as ButtonPrimitive } from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { Tooltip, TooltipContent } from "@/lib/tooltip";

export interface RichTextEditorToolbarButtonProps {
	"aria-label": string;
	icon: ComponentType<{ className?: string }>;
	isActive?: boolean;
	onClick: () => void;
}

export function RichTextEditorToolbarButton({
	"aria-label": ariaLabel,
	icon: Icon,
	isActive,
	onClick,
}: Readonly<RichTextEditorToolbarButtonProps>): ReactNode {
	return (
		<Tooltip>
			<ButtonPrimitive
				aria-label={ariaLabel}
				className={twMerge(
					"relative inline-flex items-center justify-center rounded-md text-muted-fg transition-colors block-8 inline-8 hover:text-fg focus:ring-2 focus:ring-ring focus:outline-none",
					isActive === true && "bg-primary-subtle/50 text-fg",
				)}
				onPress={() => {
					onClick();
				}}
				type="button"
			>
				<Icon className="block-4 inline-4" />
			</ButtonPrimitive>
			<TooltipContent inverse={true}>{ariaLabel}</TooltipContent>
		</Tooltip>
	);
}
