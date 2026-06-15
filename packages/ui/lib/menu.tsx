"use client";

import { CheckIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { Fragment, type ReactNode, use } from "react";
import {
	Button as AriaButton,
	type ButtonProps as AriaButtonProps,
	Collection as AriaCollection,
	Header as AriaHeader,
	Menu as AriaMenu,
	MenuItem as AriaMenuItem,
	type MenuItemProps as AriaMenuItemProps,
	type MenuProps as AriaMenuProps,
	type MenuSectionProps as AriaMenuSectionProps,
	MenuTrigger as AriaMenuTrigger,
	type MenuTriggerProps as AriaMenuTriggerProps,
	SubmenuTrigger as AriaSubmenuTrigger,
	type SubmenuTriggerProps as AriaSubmenuTriggerProps,
	MenuSection as MenuSectionPrimitive,
	composeRenderProps,
} from "react-aria-components";
import { twJoin, twMerge } from "tailwind-merge";
import { type VariantProps, tv } from "tailwind-variants";

import {
	DropdownDescription,
	DropdownKeyboard,
	DropdownLabel,
	DropdownSeparator,
	dropdownItemStyles,
	dropdownSectionStyles,
} from "@/lib/dropdown";
import { PopoverContent, type PopoverContentProps } from "@/lib/popover";
import { cx } from "@/lib/primitive";

import { UiContext } from "./ui-provider";

export interface MenuProps extends AriaMenuTriggerProps {}

export function Menu(props: Readonly<MenuProps>): ReactNode {
	return <AriaMenuTrigger {...props} />;
}

export interface MenuSubMenuProps extends AriaSubmenuTriggerProps {}

export function MenuSubMenu(props: Readonly<MenuSubMenuProps>): ReactNode {
	const { children, delay = 0, ...rest } = props;

	return (
		<AriaSubmenuTrigger {...rest} delay={delay}>
			{children}
		</AriaSubmenuTrigger>
	);
}

interface MenuTriggerProps extends AriaButtonProps {}

export function MenuTrigger(props: Readonly<MenuTriggerProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<AriaButton
			className={cx(
				"relative inline text-start outline-hidden focus-visible:ring-1 focus-visible:ring-primary",
				className,
			)}
			data-slot="menu-trigger"
			{...rest}
		/>
	);
}

interface MenuContentProps<T> extends AriaMenuProps<T>, Pick<PopoverContentProps, "placement"> {
	className?: string;
	popover?: Pick<
		PopoverContentProps,
		| "arrow"
		| "className"
		| "placement"
		| "offset"
		| "crossOffset"
		| "arrowBoundaryOffset"
		| "triggerRef"
		| "isOpen"
		| "onOpenChange"
		| "shouldFlip"
	>;
}

export const menuContentStyles = tv({
	base: "grid max-block-[inherit] grid-cols-[auto_1fr] overflow-y-auto overflow-x-hidden overscroll-contain p-1 outline-hidden [clip-path:inset(0_0_0_0_round_calc(var(--radius-xl)-(--spacing(1))))] *:[[role='group']+[role=group]]:mbs-1 *:[[role='group']+[role=separator]]:mbs-1",
});

export function MenuContent<T extends object>(props: Readonly<MenuContentProps<T>>): ReactNode {
	const { className, placement, popover, ...rest } = props;

	return (
		<PopoverContent
			className={cx("min-inline-32", popover?.className)}
			placement={placement}
			{...popover}
		>
			<AriaMenu className={menuContentStyles({ className })} data-slot="menu-content" {...rest} />
		</PopoverContent>
	);
}

interface MenuItemProps extends AriaMenuItemProps, VariantProps<typeof dropdownItemStyles> {}

export function MenuItem(props: Readonly<MenuItemProps>): ReactNode {
	const { className, intent, children, ...rest } = props;

	const { LinkComponent = "a" } = use(UiContext);

	// eslint-disable-next-line @eslint-react/prefer-destructuring-assignment
	const textValue = props.textValue ?? (typeof children === "string" ? children : undefined);

	return (
		<AriaMenuItem
			className={composeRenderProps(className, (className, { hasSubmenu, ...renderProps }) =>
				dropdownItemStyles({
					...renderProps,
					intent,
					className: hasSubmenu
						? twMerge(
								intent === "danger" && "open:bg-danger-subtle open:text-danger-subtle-fg",
								intent === "warning" && "open:bg-warning-subtle open:text-warning-subtle-fg",
								intent === undefined &&
									"open:bg-accent open:text-accent-fg open:*:data-[slot=icon]:text-accent-fg open:*:[.text-muted-fg]:text-accent-fg",
								className,
							)
						: className,
				}),
			)}
			data-slot="menu-item"
			render={(domProps, renderProps) => {
				if ("href" in domProps && domProps.href && !renderProps.isDisabled) {
					return <LinkComponent {...domProps} />;
				}

				return (
					<div
						{...domProps}
						// @ts-expect-error -- Link may be disabled but have `href`.
						href={undefined}
					/>
				);
			}}
			textValue={textValue}
			{...rest}
		>
			{(values) => (
				<Fragment>
					{values.isSelected && (
						<span
							className={twJoin(
								"group-has-data-[slot=avatar]:absolute group-has-data-[slot=avatar]:inset-e-0",
								"group-has-data-[slot=icon]:absolute group-has-data-[slot=icon]:inset-e-0",
							)}
						>
							{values.selectionMode === "single" && (
								<CheckIcon className="-mx-0.5 me-2 block-4 inline-4" data-slot="check-indicator" />
							)}
							{values.selectionMode === "multiple" && (
								<CheckIcon className="-mx-0.5 me-2 block-4 inline-4" data-slot="check-indicator" />
							)}
						</span>
					)}

					{typeof children === "function" ? children(values) : children}

					{values.hasSubmenu && (
						<ChevronRightIcon
							className="absolute inset-e-2 block-3.5 inline-3.5"
							data-slot="chevron"
						/>
					)}
				</Fragment>
			)}
		</AriaMenuItem>
	);
}

export interface MenuHeaderProps extends React.ComponentProps<typeof AriaHeader> {
	separator?: boolean;
}

export function MenuHeader(props: Readonly<MenuHeaderProps>): ReactNode {
	const { className, separator = false, ...rest } = props;

	return (
		<AriaHeader
			className={twMerge(
				"col-span-full px-2.5 py-2 font-medium text-base sm:text-sm",
				separator && "-mx-1 mbe-1 border-be sm:px-3 sm:pbe-2.5",
				className,
			)}
			{...rest}
		/>
	);
}

const { section, header } = dropdownSectionStyles();

export interface MenuSectionProps<T> extends AriaMenuSectionProps<T> {
	ref?: React.Ref<HTMLDivElement>;
	label?: string;
}

export function MenuSection<T extends object>(props: Readonly<MenuSectionProps<T>>): ReactNode {
	const { className, ref, ...rest } = props;

	return (
		<MenuSectionPrimitive ref={ref} className={section({ className })} {...rest}>
			{"label" in props && <AriaHeader className={header()}>{props.label}</AriaHeader>}
			<AriaCollection items={props.items}>{props.children}</AriaCollection>
		</MenuSectionPrimitive>
	);
}

export const MenuSeparator = DropdownSeparator;
export const MenuShortcut = DropdownKeyboard;
export const MenuLabel = DropdownLabel;
export const MenuDescription = DropdownDescription;
