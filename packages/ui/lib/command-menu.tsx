"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { useExtracted } from "next-intl";
import { type ComponentProps, type ReactNode, createContext, use, useEffect } from "react";
import {
	Autocomplete,
	type AutocompleteProps,
	Button,
	Collection,
	type CollectionRenderer,
	CollectionRendererContext,
	DefaultCollectionRenderer,
	Dialog,
	Header,
	Input,
	Menu as MenuPrimitive,
	type MenuProps,
	MenuSection,
	type MenuTriggerProps,
	Modal,
	ModalContext,
	ModalOverlay,
	OverlayTriggerStateContext,
	SearchField,
	type SearchFieldProps,
	useFilter,
} from "react-aria-components";
import { twJoin, twMerge } from "tailwind-merge";

import { cx } from "@/lib/primitive";

import { DropdownKeyboard } from "./dropdown";
import { Loader } from "./loader";
import { MenuDescription, MenuItem, MenuLabel, type MenuSectionProps, MenuSeparator } from "./menu";

export interface CommandMenuProviderProps {
	isPending?: boolean;
	escapeButton?: boolean;
}

const CommandMenuContext = createContext<CommandMenuProviderProps | undefined>(undefined);

const useCommandMenu = () => {
	const context = use(CommandMenuContext);

	if (!context) {
		throw new Error("useCommandMenu must be used within a <CommandMenuProvider />");
	}

	return context;
};

const sizes = {
	xs: "sm:max-w-xs",
	sm: "sm:max-w-sm",
	md: "sm:max-w-md",
	lg: "sm:max-w-lg",
	xl: "sm:max-w-xl",
	"2xl": "sm:max-w-2xl",
	"3xl": "sm:max-w-3xl",
};

export interface CommandMenuProps
	extends AutocompleteProps, MenuTriggerProps, CommandMenuProviderProps {
	isDismissable?: boolean;
	"aria-label"?: string;
	shortcut?: string;
	isBlurred?: boolean;
	className?: string;
	size?: keyof typeof sizes;
}

export function CommandMenu({
	onOpenChange,
	className,
	isDismissable = true,
	escapeButton = true,
	isPending,
	size = "lg",
	isBlurred,
	shortcut,
	...props
}: Readonly<CommandMenuProps>): ReactNode {
	const t = useExtracted("ui");

	const { contains } = useFilter({ sensitivity: "base" });
	const filter = (textValue: string, inputValue: string) => contains(textValue, inputValue);
	useEffect(() => {
		if (shortcut == null) {
			return;
		}

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === shortcut && (e.metaKey || e.ctrlKey)) {
				onOpenChange?.(true);
			}
		};

		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [shortcut, onOpenChange]);
	return (
		<CommandMenuContext value={{ isPending, escapeButton }}>
			<ModalContext value={{ isOpen: props.isOpen, onOpenChange }}>
				<ModalOverlay
					className={twJoin(
						"fixed inset-0 z-50 block-(--visual-viewport-height,100vh) inline-screen overflow-hidden bg-black/15",
						"grid grid-rows-[1fr_auto] justify-items-center text-center sm:grid-rows-[1fr_auto_3fr]",
						"entering:fade-in entering:animate-in entering:duration-300 entering:ease-out",
						"exiting:fade-out exiting:animate-out exiting:ease-in",
						isBlurred === true && "backdrop-blur-sm backdrop-filter",
					)}
					isDismissable={isDismissable}
					{...props}
				>
					<Modal
						className={cx(
							"row-start-2 bg-overlay text-start text-overlay-fg shadow-lg outline-none ring ring-muted-fg/15 md:row-start-1 dark:ring-border",
							"max-block-[calc(var(--visual-viewport-height)*0.8)] inline-full sm:fixed sm:inset-bs-[10%] sm:inset-s-1/2 sm:-translate-x-1/2",
							"rounded-t-2xl md:rounded-xl",
							sizes[size],
							"entering:slide-in-from-bottom entering:animate-in entering:duration-300 entering:ease-out sm:entering:zoom-in-95 sm:entering:slide-in-from-bottom-0",
							"exiting:slide-out-to-bottom exiting:animate-out exiting:ease-in sm:exiting:zoom-out-95 sm:exiting:slide-out-to-bottom-0",
							className,
						)}
					>
						<Dialog
							aria-label={props["aria-label"] ?? t("Command menu")}
							className="flex max-block-[inherit] flex-col overflow-hidden outline-hidden"
						>
							<Autocomplete filter={filter} {...props} />
						</Dialog>
					</Modal>
				</ModalOverlay>
			</ModalContext>
		</CommandMenuContext>
	);
}

export interface CommandMenuSearchProps extends SearchFieldProps {
	placeholder?: string;
	className?: string;
}

export function CommandMenuSearch({
	className,
	placeholder,
	...props
}: Readonly<CommandMenuSearchProps>): ReactNode {
	const state = use(OverlayTriggerStateContext)!;
	const { isPending, escapeButton } = useCommandMenu();
	const t = useExtracted("ui");

	return (
		<SearchField
			aria-label={t("Quick search")}
			autoFocus={true}
			className={cx("flex inline-full items-center px-2.5 py-1", className)}
			{...props}
		>
			{isPending === true ? (
				<Loader className="block-4.5 inline-4.5" variant="spin" />
			) : (
				<MagnifyingGlassIcon
					className="block-5 inline-5 shrink-0 text-muted-fg"
					data-slot="command-menu-search-icon"
				/>
			)}
			<Input
				className="inline-full min-inline-0 bg-transparent px-2.5 py-2 text-base text-fg placeholder-muted-fg outline-hidden focus:outline-hidden sm:px-2 sm:py-1.5 sm:text-sm [&::-ms-reveal]:hidden [&::-webkit-search-cancel-button]:hidden"
				placeholder={placeholder ?? t("Search...")}
			/>
			{escapeButton === true && (
				<Button
					className="hidden cursor-default rounded-sm border text-current/90 hover:bg-muted lg:inline lg:px-1.5 lg:py-0.5 lg:text-xs"
					onPress={() => {
						state.close();
					}}
				>
					{"Esc"}
				</Button>
			)}
		</SearchField>
	);
}

export function CommandMenuList<T extends object>({
	className,
	...props
}: Readonly<MenuProps<T>>): ReactNode {
	return (
		// oxlint-disable-next-line no-use-before-define
		<CollectionRendererContext value={renderer}>
			<MenuPrimitive
				className={cx(
					"grid max-block-full flex-1 grid-cols-[auto_1fr] content-start overflow-y-auto border-bs p-2 sm:max-block-110 *:[[role=group]]:mbe-6 *:[[role=group]]:last:mbe-0",
					className,
				)}
				{...props}
			/>
		</CollectionRendererContext>
	);
}

export function CommandMenuSection<T extends object>({
	className,
	...props
}: Readonly<MenuSectionProps<T>>): ReactNode {
	return (
		<MenuSection
			className={twMerge(
				"col-span-full grid grid-cols-[auto_1fr] content-start gap-y-px",
				className,
			)}
			{...props}
		>
			{"label" in props && (
				<Header className="col-span-full mbe-1 block min-inline-(--trigger-width) truncate px-2.5 text-muted-fg text-xs">
					{props.label}
				</Header>
			)}
			<Collection items={props.items}>{props.children}</Collection>
		</MenuSection>
	);
}

export function CommandMenuItem({
	className,
	...props
}: Readonly<ComponentProps<typeof MenuItem>>): ReactNode {
	const textValue =
		props.textValue ?? (typeof props.children === "string" ? props.children : undefined);
	return (
		<MenuItem
			{...props}
			className={cx("items-center gap-y-0.5", className)}
			textValue={textValue}
		/>
	);
}

export interface CommandMenuDescriptionProps extends ComponentProps<typeof MenuDescription> {}

export function CommandMenuDescription({
	className,
	...props
}: Readonly<CommandMenuDescriptionProps>): ReactNode {
	return (
		<MenuDescription className={twMerge("col-start-3 row-start-1 ms-auto", className)} {...props} />
	);
}

const renderer: CollectionRenderer = {
	CollectionRoot(props: Readonly<ComponentProps<CollectionRenderer["CollectionRoot"]>>) {
		const { collection } = props;
		if (collection.size === 0) {
			return (
				<div className="col-span-full p-4 text-center text-muted-fg text-sm">
					{"No results found."}
				</div>
			);
		}
		return <DefaultCollectionRenderer.CollectionRoot {...props} />;
	},
	CollectionBranch: DefaultCollectionRenderer.CollectionBranch,
};

export function CommandMenuSeparator({
	className,
	...props
}: Readonly<ComponentProps<typeof MenuSeparator>>): ReactNode {
	return <MenuSeparator className={twMerge("-mx-2", className)} {...props} />;
}

export function CommandMenuFooter({
	className,
	...props
}: Readonly<ComponentProps<"div">>): ReactNode {
	return (
		<div
			className={twMerge(
				"col-span-full flex-none border-bs px-2 py-1.5 text-muted-fg text-sm",
				"*:[kbd]:inset-ring *:[kbd]:inset-ring-fg/10 *:[kbd]:mx-1 *:[kbd]:inline-grid *:[kbd]:block-4 *:[kbd]:min-inline-4 *:[kbd]:place-content-center *:[kbd]:rounded-xs *:[kbd]:bg-secondary",
				className,
			)}
			{...props}
		/>
	);
}

export const CommandMenuLabel = MenuLabel;
export function CommandMenuShortcut({
	className,
	...props
}: Readonly<ComponentProps<typeof DropdownKeyboard>>): ReactNode {
	return (
		<DropdownKeyboard
			className={twMerge(
				"gap-0.5 text-[10.5px] uppercase *:inset-ring *:inset-ring-muted-fg/20 *:grid *:block-5.5 *:inline-5.5 *:place-content-center *:rounded-xs *:bg-bg",
				className,
			)}
			{...props}
		/>
	);
}
