"use client";

import {
	MoonIcon as IconDark,
	SunIcon as IconLight,
	ComputerDesktopIcon as IconSystem,
} from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { RadioButton, RadioField, RadioGroup } from "react-aria-components";
import { twJoin, twMerge } from "tailwind-merge";

import type { ColorScheme } from "@/lib/color-scheme/color-scheme-script";
import { useColorScheme } from "@/lib/color-scheme/use-color-scheme";

/**
 * A color scheme only ever resolves to light or dark, but there are three settings to choose
 * between: following the operating system is a state of its own, distinct from having picked
 * whichever scheme it happens to resolve to right now.
 */
type ColorSchemePreference = ColorScheme | "system";

function toColorScheme(preference: string): ColorScheme | null {
	return preference === "light" || preference === "dark" ? preference : null;
}

interface ColorSchemeToggleProps {
	className?: string;
	/**
	 * Stacks the options, e.g. to fit a docked sidebar. Also switches which arrow keys move between
	 * them.
	 */
	orientation?: "horizontal" | "vertical";
}

export function ColorSchemeToggle(props: Readonly<ColorSchemeToggleProps>): ReactNode {
	const { className, orientation = "horizontal" } = props;

	const { kind, colorScheme, setColorScheme } = useColorScheme();

	const t = useExtracted();

	const preferences: Array<{
		value: ColorSchemePreference;
		label: string;
		Icon: ComponentType<ComponentProps<"svg">>;
	}> = [
		{ value: "system", label: t("System"), Icon: IconSystem },
		{ value: "light", label: t("Light"), Icon: IconLight },
		{ value: "dark", label: t("Dark"), Icon: IconDark },
	];

	/**
	 * Which preference is in effect can only be read on the client, so nothing is selected in the
	 * server-rendered markup.
	 */
	const value: ColorSchemePreference | null =
		kind === "server" ? null : kind === "system" ? "system" : colorScheme;

	return (
		<RadioGroup
			aria-label={t("Color scheme")}
			className={twMerge(
				"inline-flex items-center gap-0.5 rounded-full bg-muted p-0.5 inset-ring inset-ring-border",
				orientation === "vertical" && "flex-col",
				className,
			)}
			onChange={(preference) => {
				setColorScheme(toColorScheme(preference));
			}}
			orientation={orientation}
			value={value}
		>
			{preferences.map(({ value, label, Icon }) => (
				<RadioField key={value} className="contents" value={value}>
					<RadioButton
						className={({ isSelected, isFocusVisible, isHovered }) =>
							twJoin(
								"touch-area grid cursor-default place-items-center rounded-full text-muted-fg transition duration-200 block-7 inline-7",
								isHovered && "text-fg",
								/**
								 * The selected option reads as a knob lifted off the track, so it needs to stay
								 * lighter than the `muted` track in both schemes - which means opposite ends of the
								 * scale, since `bg` is the lightest token in light mode but nearly the darkest in
								 * dark mode.
								 */
								isSelected && "bg-bg text-fg shadow-xs inset-ring inset-ring-border dark:bg-accent",
								isFocusVisible && "outline-2 outline-offset-2 outline-ring",
							)
						}
					>
						<span className="sr-only">{label}</span>
						<Icon aria-hidden={true} className="block-4 inline-4" />
					</RadioButton>
				</RadioField>
			))}
		</RadioGroup>
	);
}
