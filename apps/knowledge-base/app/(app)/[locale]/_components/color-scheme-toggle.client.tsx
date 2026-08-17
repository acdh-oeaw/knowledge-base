"use client";

import { Switch, type SwitchProps } from "@dariah-eric/ui/switch";
import type { ReactNode } from "react";

import { useColorScheme } from "@/lib/color-scheme/use-color-scheme";

interface ColorSchemeToggleProps extends Pick<SwitchProps, "className"> {
	label: string;
}

export function ColorSchemeToggle(props: Readonly<ColorSchemeToggleProps>): ReactNode {
	const { className, label } = props;

	const { colorScheme, setColorScheme } = useColorScheme();

	return (
		<Switch
			aria-label={label}
			className={className}
			isSelected={colorScheme === "dark"}
			onChange={() => {
				setColorScheme(colorScheme === "dark" ? "light" : "dark");
			}}
		/>
	);
}
