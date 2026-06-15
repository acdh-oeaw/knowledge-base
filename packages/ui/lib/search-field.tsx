"use client";

import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";
import {
	Button as AriaButton,
	SearchField as AriaSearchField,
	type InputProps,
	type SearchFieldProps,
} from "react-aria-components";
import { twJoin } from "tailwind-merge";

import { fieldStyles } from "@/lib/field";
import { Input, InputGroup } from "@/lib/input";
import { cx } from "@/lib/primitive";

export function SearchField(props: Readonly<SearchFieldProps>): ReactNode {
	const { className, ...rest } = props;

	const t = useExtracted("ui");

	return (
		<AriaSearchField
			{...rest}
			aria-label={props["aria-label"] ?? t("Search")}
			className={cx(fieldStyles({ className: "group/search-field" }), className)}
		/>
	);
}

export function SearchInput(props: Readonly<InputProps>): ReactNode {
	const t = useExtracted("ui");

	return (
		<InputGroup className="[--input-gutter-end:--spacing(8)]">
			<MagnifyingGlassIcon />
			<Input {...props} />
			<AriaButton
				aria-label={t("Clear search")}
				className={twJoin(
					"touch-area grid place-content-center text-muted-fg pressed:text-fg hover:text-fg group-empty/search-field:invisible",
					"px-3 py-2 sm:px-2.5 sm:py-1.5 sm:text-sm/5",
				)}
			>
				<XMarkIcon className="block-5 inline-5 sm:block-4 sm:inline-4" />
			</AriaButton>
		</InputGroup>
	);
}
