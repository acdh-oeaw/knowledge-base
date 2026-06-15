"use client";

import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { useExtracted } from "next-intl";
import {
	type ComponentProps,
	Fragment,
	type ReactNode,
	type Ref,
	createContext,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Button as AriaButton,
	type ButtonProps as AriaButtonProps,
	Disclosure as AriaDisclosure,
	DisclosureGroup as AriaDisclosureGroup,
	type DisclosureGroupProps as AriaDisclosureGroupProps,
	DisclosurePanel as AriaDisclosurePanel,
	type DisclosurePanelProps as AriaDisclosurePanelProps,
	type DisclosureProps as AriaDisclosureProps,
	Header as AriaHeader,
	Heading as AriaHeading,
	type LinkProps as AriaLinkProps,
	type LinkRenderProps as AriaLinkRenderProps,
	Separator as AriaSeparator,
	type SeparatorProps as AriaSeparatorProps,
	Text as AriaText,
	Tree as AriaTree,
	TreeItem as AriaTreeItem,
	TreeItemContent as AriaTreeItemContent,
	type TreeItemContentProps as AriaTreeItemContentProps,
	type TreeItemProps as AriaTreeItemProps,
	type TreeProps as AriaTreeProps,
	composeRenderProps,
} from "react-aria-components";
import { twJoin, twMerge } from "tailwind-merge";

import { Button } from "@/lib/button";
import { Link } from "@/lib/link";
import { cx } from "@/lib/primitive";
import { SheetContent } from "@/lib/sheet";
import { Tooltip, TooltipContent } from "@/lib/tooltip";
import { TreeIndicator } from "@/lib/tree";
import { useIsMobile } from "@/lib/use-mobile";

const SIDEBAR_WIDTH = "18rem";
const SIDEBAR_WIDTH_DOCK = "3.25rem";
const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

interface SidebarContextProps {
	state: "expanded" | "collapsed";
	open: boolean;
	setOpen: (open: boolean) => void;
	isOpenOnMobile: boolean;
	setIsOpenOnMobile: (open: boolean) => void;
	isMobile: boolean;
	toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextProps | null>(null);

export function useSidebar(): SidebarContextProps {
	const context = use(SidebarContext);

	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider.");
	}

	return context;
}

export interface SidebarProviderProps extends ComponentProps<"div"> {
	defaultOpen?: boolean;
	isOpen?: boolean;
	shortcut?: string;
	onOpenChange?: (open: boolean) => void;
}

export function SidebarProvider(props: Readonly<SidebarProviderProps>): ReactNode {
	const {
		defaultOpen = true,
		isOpen: openProp,
		onOpenChange: setOpenProp,
		className,
		style,
		children,
		shortcut = "b",
		ref,
		...rest
	} = props;

	const [openMobile, setOpenMobile] = useState(false);

	const [internalOpenState, setInternalOpenState] = useState(defaultOpen);

	const open = openProp ?? internalOpenState;

	const setOpen = useCallback(
		(value: boolean | ((value: boolean) => boolean)) => {
			const openState = typeof value === "function" ? value(open) : value;

			if (setOpenProp) {
				setOpenProp(openState);
			} else {
				setInternalOpenState(openState);
			}

			// eslint-disable-next-line unicorn/no-document-cookie, @typescript-eslint/restrict-template-expressions
			document.cookie = `${SIDEBAR_COOKIE_NAME}=${String(openState)}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
		},
		[setOpenProp, open],
	);

	const isMobile = useIsMobile();
	const isMobileRef = useRef(isMobile);
	// eslint-disable-next-line react-hooks/refs
	isMobileRef.current = isMobile;

	const toggleSidebar = useCallback(() => {
		if (isMobileRef.current) {
			setOpenMobile((prev) => !prev);
		} else {
			setOpen((prev) => !prev);
		}
	}, [setOpen]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === shortcut && (event.metaKey || event.ctrlKey)) {
				const activeElement = document.activeElement;

				const isInTextInput =
					activeElement instanceof HTMLInputElement ||
					activeElement instanceof HTMLTextAreaElement ||
					activeElement?.getAttribute("contenteditable") === "true" ||
					activeElement?.getAttribute("role") === "textbox";

				if (!isInTextInput) {
					event.preventDefault();
					toggleSidebar();
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [toggleSidebar, shortcut]);

	const state = open ? "expanded" : "collapsed";

	const contextValue = useMemo<SidebarContextProps>(() => {
		return {
			state,
			open,
			setOpen,
			isMobile,
			isOpenOnMobile: openMobile,
			setIsOpenOnMobile: setOpenMobile,
			toggleSidebar,
		};
	}, [state, open, setOpen, isMobile, openMobile, toggleSidebar]);

	return (
		<SidebarContext value={contextValue}>
			<div
				ref={ref}
				className={twMerge(
					"@container **:data-[slot=icon]:shrink-0",
					"flex inline-full text-sidebar-fg",
					"group/sidebar-root peer/sidebar-root dark:has-data-[intent=inset]:bg-bg has-data-[intent=inset]:bg-sidebar",
					className,
				)}
				style={{
					"--sidebar-width": SIDEBAR_WIDTH,
					"--sidebar-width-dock": SIDEBAR_WIDTH_DOCK,
					...style,
				}}
				{...rest}
			>
				{children}
			</div>
		</SidebarContext>
	);
}

export interface SidebarProps extends ComponentProps<"div"> {
	intent?: "default" | "float" | "inset";
	collapsible?: "hidden" | "dock" | "none";
	side?: "left" | "right";
	closeButton?: boolean;
}

export function Sidebar(props: Readonly<SidebarProps>): ReactNode {
	const {
		children,
		closeButton = true,
		collapsible = "hidden",
		side = "left",
		intent = "default",
		className,
		...rest
	} = props;

	const { isMobile, state, isOpenOnMobile, setIsOpenOnMobile } = useSidebar();

	const t = useExtracted("ui");

	if (collapsible === "none") {
		return (
			<div
				className={twMerge(
					"flex block-full inline-(--sidebar-width) flex-col bg-sidebar text-sidebar-fg",
					className,
				)}
				data-collapsible="none"
				data-intent={intent}
				data-slot="sidebar"
				{...rest}
			>
				{children}
			</div>
		);
	}

	if (isMobile) {
		return (
			<Fragment>
				<span aria-hidden={true} className="sr-only" data-intent={intent} />
				<SheetContent
					aria-label={t("Sidebar")}
					className="inline-(--sidebar-width) [--sidebar-width:18rem] entering:blur-in exiting:blur-out has-data-[slot=calendar]:[--sidebar-width:23rem]"
					closeButton={closeButton}
					data-intent="default"
					data-slot="sidebar"
					dir={side === "right" ? "rtl" : "ltr"}
					isOpen={isOpenOnMobile}
					onOpenChange={setIsOpenOnMobile}
					side={side}
				>
					{children}
				</SheetContent>
			</Fragment>
		);
	}

	return (
		<div
			className="group peer hidden text-sidebar-fg md:block"
			data-collapsible={state === "collapsed" ? collapsible : ""}
			data-intent={intent}
			data-side={side}
			data-slot="sidebar"
			data-state={state}
			{...props}
		>
			<div
				aria-hidden="true"
				className={twMerge([
					"inline-(--sidebar-width) group-data-[collapsible=hidden]:inline-0",
					"group-data-[side=right]:-rotate-180",
					"relative block-svh bg-transparent transition-[width] duration-200 ease-linear",
					intent === "default" && "group-data-[collapsible=dock]:inline-(--sidebar-width-dock)",
					intent === "float" &&
						"group-data-[collapsible=dock]:inline-[calc(var(--sidebar-width-dock)+(--spacing(4)))]",
					intent === "inset" &&
						"group-data-[collapsible=dock]:inline-[calc(var(--sidebar-width-dock)+(--spacing(2)))]",
				])}
				data-slot="sidebar-gap"
			/>
			<div
				className={twMerge(
					"fixed inset-y-0 z-10 hidden inline-(--sidebar-width) bg-sidebar md:flex not-has-data-[slot=sidebar-footer]:pbe-2",
					"transition-[left,right,width] duration-200 ease-linear",
					side === "left" && "inset-s-0 group-data-[collapsible=hidden]:-inset-s-(--sidebar-width)",
					side === "right" &&
						"inset-e-0 group-data-[collapsible=hidden]:-inset-e-(--sidebar-width)",
					intent === "float" &&
						"bg-bg p-2 group-data-[collapsible=dock]:inline-[calc(--spacing(4)+2px)]",
					intent === "inset" &&
						"dark:bg-bg group-data-[collapsible=dock]:inline-[calc(var(--sidebar-width-dock)+(--spacing(2))+2px)]",
					intent === "default" && [
						"group-data-[collapsible=dock]:inline-(--sidebar-width-dock)",
						"border-sidebar-border group-data-[side=left]:border-e group-data-[side=right]:border-s",
					],
					className,
				)}
				data-slot="sidebar-container"
				{...props}
			>
				<div
					className={twJoin(
						"flex block-full inline-full flex-col text-sidebar-fg",
						"group-data-[intent=float]:rounded-lg group-data-[intent=float]:border group-data-[intent=float]:border-sidebar-border group-data-[intent=float]:bg-sidebar group-data-[intent=float]:shadow-xs",
					)}
					data-sidebar="default"
					data-slot="sidebar-inner"
				>
					{children}
				</div>
			</div>
		</div>
	);
}

export interface SidebarHeaderProps extends ComponentProps<"div"> {}

export function SidebarHeader(props: Readonly<SidebarHeaderProps>): ReactNode {
	const { className, ref, ...rest } = props;

	const { state } = useSidebar();

	return (
		<div
			ref={ref}
			className={twMerge(
				"flex flex-col gap-2 p-2.5 [.border-b]:border-sidebar-border",
				"in-data-[intent=inset]:p-4",
				state === "collapsed" ? "items-center p-2.5" : "p-4",
				className,
			)}
			data-slot="sidebar-header"
			{...rest}
		/>
	);
}

export interface SidebarFooterProps extends ComponentProps<"div"> {}

export function SidebarFooter(props: Readonly<SidebarFooterProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<div
			className={twMerge([
				"mbs-auto flex shrink-0 items-center justify-center p-4 **:data-[slot=chevron]:text-muted-fg",
				"in-data-[intent=inset]:px-6 in-data-[intent=inset]:py-4",
				className,
			])}
			data-slot="sidebar-footer"
			{...rest}
		/>
	);
}

export interface SidebarContentProps extends ComponentProps<"div"> {}

export function SidebarContent(props: Readonly<SidebarContentProps>): ReactNode {
	const { className, ...rest } = props;

	const { state } = useSidebar();
	const [isAtBottom, setIsAtBottom] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) {
			return;
		}

		const check = () => {
			const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 1;
			setIsAtBottom(atBottom);
		};

		check();
		el.addEventListener("scroll", check, { passive: true });

		const observer = new ResizeObserver(check);
		observer.observe(el);

		return () => {
			el.removeEventListener("scroll", check);
			observer.disconnect();
		};
	}, []);

	return (
		<div
			ref={ref}
			className={twMerge(
				"flex min-block-0 flex-1 scroll-mbe-96 flex-col overflow-auto *:data-[slot=sidebar-section]:border-s-0",
				state === "collapsed" ? "items-center" : !isAtBottom && "mask-b-from-95%",
				className,
			)}
			data-slot="sidebar-content"
			{...rest}
		>
			{props.children}
		</div>
	);
}

export interface SidebarSectionGroupProps extends ComponentProps<"section"> {}

export function SidebarSectionGroup(props: Readonly<SidebarSectionGroupProps>): ReactNode {
	const { className, ...rest } = props;

	const { state, isMobile } = useSidebar();
	const collapsed = state === "collapsed" && !isMobile;

	return (
		<section
			className={twMerge(
				"flex inline-full min-inline-0 flex-col gap-y-0.5",
				collapsed && "items-center justify-center",
				className,
			)}
			data-slot="sidebar-section-group"
			{...rest}
		/>
	);
}

export interface SidebarSectionProps extends ComponentProps<"div"> {
	label?: string;
}

export function SidebarSection(props: Readonly<SidebarSectionProps>): ReactNode {
	const { children, className, label, ...rest } = props;

	const { state } = useSidebar();

	return (
		<div
			className={twMerge(
				"col-span-full flex min-inline-0 flex-col gap-y-0.5 **:data-[slot=sidebar-section]:**:gap-y-0",
				"p-4 in-data-[state=collapsed]:p-2",
				className,
			)}
			data-slot="sidebar-section"
			{...rest}
		>
			{state !== "collapsed" && label != null && (
				<AriaHeader className="mbe-1 flex shrink-0 items-center rounded-md px-2 text-sidebar-fg/70 text-xs/6 outline-none ring-sidebar-ring transition-[margin,opa] duration-200 ease-linear *:data-[slot=icon]:block-4 *:data-[slot=icon]:inline-4 *:data-[slot=icon]:shrink-0 group-data-[collapsible=dock]:-mbs-8 group-data-[collapsible=dock]:opacity-0">
					{label}
				</AriaHeader>
			)}
			<div
				className="grid grid-cols-[auto_1fr] gap-y-0.5 *:data-[slot=control]:col-span-full in-data-[state=collapsed]:gap-y-1.5"
				data-slot="sidebar-section-inner"
			>
				{children}
			</div>
		</div>
	);
}

export interface SidebarItemProps extends Omit<ComponentProps<typeof Link>, "children"> {
	isCurrent?: boolean;
	children?:
		| ReactNode
		| ((
				values: AriaLinkRenderProps & { defaultChildren: ReactNode; isCollapsed: boolean },
		  ) => ReactNode);
	badge?: string | number | undefined;
	tooltip?: string | ComponentProps<typeof TooltipContent>;
}

export function SidebarItem(props: Readonly<SidebarItemProps>): ReactNode {
	const { isCurrent, tooltip, children, badge, className, ...rest } = props;

	const { state, isMobile } = useSidebar();
	const isCollapsed = state === "collapsed" && !isMobile;

	const link = (
		<Link
			aria-current={isCurrent === true ? "page" : undefined}
			className={composeRenderProps(
				className,
				(className, { isFocusVisible, isPressed, isHovered, isDisabled }) =>
					twMerge(
						"inline-full min-inline-0 items-center rounded-lg p-2 text-start font-medium text-base/6 text-sidebar-fg has-[a]:p-0",
						"group/sidebar-item relative col-span-full overflow-hidden focus-visible:outline-hidden",
						"grid grid-cols-[auto_1fr_1.5rem_0.5rem_auto] sm:text-sm/5 **:last:data-[slot=icon]:ms-auto supports-[grid-template-columns:subgrid]:grid-cols-subgrid",
						// icon
						// eslint-disable-next-line better-tailwindcss/enforce-consistent-class-order
						"sm:[&_[data-slot='icon']:not([class*='size-'])]:block-4 sm:[&_[data-slot='icon']:not([class*='size-'])]:inline-4 [&_[data-slot='icon']:not([class*='size-'])]:block-5 [&_[data-slot='icon']:not([class*='size-'])]:inline-5 [&_[data-slot='icon']:not([class*='text-'])]:text-muted-fg **:data-[slot=icon]:shrink-0",
						"**:last:data-[slot=icon]:block-5 **:last:data-[slot=icon]:inline-5 sm:**:last:data-[slot=icon]:block-4 sm:**:last:data-[slot=icon]:inline-4",
						"[&:has([data-slot=icon]+[data-slot=sidebar-label])_[data-slot=icon]:has(+[data-slot=sidebar-label])]:me-2",

						// avatar
						"**:data-[slot=avatar]:[--avatar-size:--spacing(5)]",
						"[&:has([data-slot=avatar]+[data-slot=sidebar-label])_[data-slot=avatar]:has(+[data-slot=sidebar-label])]:me-2",
						"[--sidebar-current-bg:var(--color-sidebar-primary)] [--sidebar-current-fg:var(--color-sidebar-primary-fg)]",
						isCurrent === true &&
							"font-medium text-(--sidebar-current-fg) hover:bg-(--sidebar-current-bg) hover:text-(--sidebar-current-fg) hover:[&_[data-slot='icon']:not([class*='text-'])]:text-(--sidebar-current-fg) [&_.text-muted-fg]:text-fg/80 [&_[data-slot='icon']:not([class*='text-'])]:text-(--sidebar-current-fg)",
						isFocusVisible && "inset-ring inset-ring-sidebar-ring outline-hidden",
						isPressed &&
							"bg-sidebar-accent text-sidebar-accent-fg [&_[data-slot='icon']:not([class*='text-'])]:text-sidebar-accent-fg",
						isHovered &&
							"bg-sidebar-accent text-sidebar-accent-fg [&_[data-slot='icon']:not([class*='text-'])]:text-sidebar-accent-fg",
						isDisabled && "opacity-50",
						className,
					),
			)}
			data-slot="sidebar-item"
			{...rest}
		>
			{(values) => (
				<Fragment>
					{typeof children === "function" ? children({ ...values, isCollapsed }) : children}

					{badge != null &&
						(state !== "collapsed" ? (
							<span
								className="absolute inset-ring-1 inset-ring-sidebar-border inset-y-1/2 inset-e-1.5 block-5.5 inline-auto -translate-y-1/2 rounded-full bg-fg/5 px-2 text-[10px]/5.5 group-hover/sidebar-item:inset-ring-muted-fg/30 group-current:inset-ring-transparent"
								data-slot="sidebar-badge"
							>
								{badge}
							</span>
						) : (
							<div
								aria-hidden={true}
								className="absolute inset-e-1 inset-bs-1 block-1.5 inline-1.5 rounded-full bg-primary"
							/>
						))}
				</Fragment>
			)}
		</Link>
	);

	const _tooltip =
		typeof tooltip === "string"
			? {
					children: tooltip,
				}
			: tooltip;

	return (
		<Tooltip delay={0}>
			{link}
			<TooltipContent
				arrow={true}
				className="**:data-[slot=icon]:hidden **:data-[slot=sidebar-label-mask]:hidden"
				hidden={!isCollapsed || !_tooltip}
				inverse={true}
				placement="right"
				{..._tooltip}
			/>
		</Tooltip>
	);
}

export interface SidebarLinkProps extends AriaLinkProps {}

export function SidebarLink(props: Readonly<SidebarLinkProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<Link
			className={cx(
				"col-span-full min-inline-0 shrink-0 items-center p-2 focus:outline-hidden",
				"grid grid-cols-[auto_1fr_1.5rem_0.5rem_auto] supports-[grid-template-columns:subgrid]:grid-cols-subgrid",
				className,
			)}
			{...rest}
		/>
	);
}

export interface SidebarInsetProps extends ComponentProps<"main"> {}

export function SidebarInset(props: Readonly<SidebarInsetProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<main
			className={twMerge(
				"relative flex inline-full flex-1 flex-col bg-bg lg:min-inline-0",
				"group-has-data-[intent=inset]/sidebar-root:border group-has-data-[intent=inset]/sidebar-root:border-sidebar-border group-has-data-[intent=inset]/sidebar-root:bg-overlay",
				"md:group-has-data-[intent=inset]/sidebar-root:m-2",
				"md:group-has-data-[side=left]:group-has-data-[intent=inset]/sidebar-root:ms-0",
				"md:group-has-data-[side=right]:group-has-data-[intent=inset]/sidebar-root:me-0",
				"md:group-has-data-[intent=inset]/sidebar-root:rounded-2xl",
				"md:group-has-data-[intent=inset]/sidebar-root:peer-data-[state=collapsed]:ms-2",
				className,
			)}
			data-slot="sidebar-inset"
			{...rest}
		/>
	);
}

export type SidebarDisclosureGroupProps = AriaDisclosureGroupProps;

export function SidebarDisclosureGroup(props: Readonly<SidebarDisclosureGroupProps>): ReactNode {
	const { allowsMultipleExpanded = true, className, ...rest } = props;

	return (
		<AriaDisclosureGroup
			allowsMultipleExpanded={allowsMultipleExpanded}
			className={cx(
				"col-span-full flex min-inline-0 flex-col gap-y-0.5 in-data-[state=collapsed]:gap-y-1.5",
				className,
			)}
			data-slot="sidebar-disclosure-group"
			{...rest}
		/>
	);
}

export interface SidebarDisclosureProps extends AriaDisclosureProps {}

export function SidebarDisclosure(props: Readonly<SidebarDisclosureProps>): ReactNode {
	const { className, ...rest } = props;

	const { state } = useSidebar();

	return (
		<AriaDisclosure
			className={cx(
				"col-span-full min-inline-0",
				state === "collapsed" ? "px-2" : "px-4",
				className,
			)}
			data-slot="sidebar-disclosure"
			{...rest}
		/>
	);
}

export interface SidebarDisclosureTriggerProps extends AriaButtonProps {
	ref?: Ref<HTMLButtonElement>;
}

export function SidebarDisclosureTrigger(
	props: Readonly<SidebarDisclosureTriggerProps>,
): ReactNode {
	const { className, ref, ...rest } = props;

	const { state } = useSidebar();

	return (
		<AriaHeading level={3}>
			<AriaButton
				ref={ref}
				className={composeRenderProps(
					className,
					(className, { isPressed, isFocusVisible, isHovered, isDisabled }) =>
						twMerge(
							"flex inline-full min-inline-0 items-center rounded-lg text-start font-medium text-base/6 text-sidebar-fg",
							"group/sidebar-disclosure-trigger relative col-span-full overflow-hidden focus-visible:outline-hidden",
							"**:data-[slot=icon]:block-5 **:data-[slot=icon]:inline-5 **:data-[slot=icon]:shrink-0 **:data-[slot=icon]:text-muted-fg sm:**:data-[slot=icon]:block-4 sm:**:data-[slot=icon]:inline-4",
							"**:last:data-[slot=icon]:block-5 **:last:data-[slot=icon]:inline-5 sm:**:last:data-[slot=icon]:block-4 sm:**:last:data-[slot=icon]:inline-4",
							"**:data-[slot=avatar]:block-6 **:data-[slot=avatar]:inline-6 sm:**:data-[slot=avatar]:block-5 sm:**:data-[slot=avatar]:inline-5",
							"col-span-full gap-3 p-2 sm:gap-2 sm:text-sm/5 **:last:data-[slot=icon]:ms-auto **:data-[slot=chevron]:text-muted-fg",

							isFocusVisible && "inset-ring inset-ring-ring/70",
							(isPressed || isHovered) &&
								"bg-sidebar-accent text-sidebar-accent-fg **:last:data-[slot=icon]:text-sidebar-accent-fg **:data-[slot=chevron]:text-sidebar-accent-fg **:data-[slot=icon]:text-sidebar-accent-fg",
							isDisabled && "opacity-50",
							className,
						),
				)}
				slot="trigger"
				{...rest}
			>
				{(values) => (
					<Fragment>
						{typeof props.children === "function" ? props.children(values) : props.children}
						{state !== "collapsed" && (
							<ChevronDownIcon
								className="z-10 ms-auto block-3.5 inline-3.5 transition-transform duration-200 group-aria-expanded/sidebar-disclosure-trigger:rotate-180"
								data-slot="chevron"
							/>
						)}
					</Fragment>
				)}
			</AriaButton>
		</AriaHeading>
	);
}

export interface SidebarDisclosurePanelProps extends AriaDisclosurePanelProps {}

export function SidebarDisclosurePanel(props: Readonly<SidebarDisclosurePanelProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<AriaDisclosurePanel
			className={cx(
				"block-(--disclosure-panel-height) overflow-clip transition-[height] duration-200",
				className,
			)}
			data-slot="sidebar-disclosure-panel"
			{...rest}
		>
			<div
				className="col-span-full grid grid-cols-[auto_1fr] gap-y-0.5 in-data-[state=collapsed]:gap-y-1.5"
				data-slot="sidebar-disclosure-panel-content"
			>
				{props.children}
			</div>
		</AriaDisclosurePanel>
	);
}

export interface SidebarSeparatorProps extends AriaSeparatorProps {}

export function SidebarSeparator(props: Readonly<SidebarSeparatorProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<AriaSeparator
			className={twMerge(
				"mx-auto block-px inline-[calc(var(--sidebar-width)-(--spacing(10)))] border-0 bg-sidebar-border forced-colors:bg-[ButtonBorder]",
				className,
			)}
			data-slot="sidebar-separator"
			orientation="horizontal"
			{...rest}
		/>
	);
}

export interface SidebarTriggerProps extends ComponentProps<typeof Button> {}

export function SidebarTrigger(props: Readonly<SidebarTriggerProps>): ReactNode {
	const { onPress, className, children, ...rest } = props;

	const { toggleSidebar } = useSidebar();

	const t = useExtracted("ui");

	return (
		<Button
			aria-label={props["aria-label"] ?? t("Toggle sidebar")}
			className={cx("shrink-0", className)}
			data-slot="sidebar-trigger"
			intent={props.intent ?? "plain"}
			onPress={(event) => {
				onPress?.(event);
				toggleSidebar();
			}}
			size={props.size ?? "sq-sm"}
			{...rest}
		>
			{children ?? (
				<Fragment>
					<svg
						className="block-4 inline-4"
						data-slot="icon"
						fill="currentcolor"
						height={16}
						viewBox="0 0 16 16"
						width={16}
						xmlns="http://www.w3.org/2000/svg"
					>
						<path d="M13.25 2.5c.69 0 1.25.56 1.25 1.25v8.5c0 .69-.56 1.25-1.25 1.25H7.5V15h5.75A2.75 2.75 0 0 0 16 12.25v-8.5A2.75 2.75 0 0 0 13.25 1H7.5v1.5zM5.75 1a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-3A2.75 2.75 0 0 1 0 12.25v-8.5A2.75 2.75 0 0 1 2.75 1z" />
					</svg>
					<span className="sr-only">{t("Toggle Sidebar")}</span>
				</Fragment>
			)}
		</Button>
	);
}

export interface SidebarRailProps extends ComponentProps<"button"> {}

export function SidebarRail(props: Readonly<SidebarRailProps>): ReactNode {
	const { className, ref, ...rest } = props;

	const { toggleSidebar } = useSidebar();

	const t = useExtracted("ui");

	return (
		props.children ?? (
			<button
				ref={ref}
				aria-label={t("Toggle sidebar")}
				className={twMerge(
					"absolute inset-y-0 z-20 hidden inline-4 -translate-x-1/2 outline-hidden transition-all ease-linear after:absolute after:inset-y-0 after:inset-s-1/2 after:inline-0.5 sm:flex hover:after:bg-transparent group-data-[side=left]:-inset-e-4 group-data-[side=right]:inset-s-0",
					"in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
					"[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
					"group-data-[collapsible=hidden]:translate-x-0 group-data-[collapsible=hidden]:hover:bg-sidebar-accent group-data-[collapsible=hidden]:after:inset-s-full",
					"[[data-side=left][data-collapsible=hidden]_&]:-inset-e-2 [[data-side=right][data-collapsible=hidden]_&]:-inset-s-2",
					className,
				)}
				data-slot="sidebar-rail"
				onClick={toggleSidebar}
				tabIndex={-1}
				title={t("Toggle Sidebar")}
				type="button"
				{...rest}
			/>
		)
	);
}

export interface SidebarLabelProps extends ComponentProps<typeof AriaText> {}

export function SidebarLabel({ className, ref, ...props }: Readonly<SidebarLabelProps>): ReactNode {
	const { state, isMobile } = useSidebar();

	const collapsed = state === "collapsed" && !isMobile;

	if (!collapsed) {
		return (
			<AriaText
				ref={ref}
				className={twMerge("col-start-2 truncate pe-6 outline-hidden", className)}
				data-slot="sidebar-label"
				slot="label"
				tabIndex={-1}
				{...props}
			>
				{props.children}
			</AriaText>
		);
	}
	return null;
}

export interface SidebarNavProps extends ComponentProps<"nav"> {
	isSticky?: boolean;
}

export function SidebarNav({
	isSticky = false,
	className,
	...props
}: Readonly<SidebarNavProps>): ReactNode {
	return (
		<nav
			className={twMerge(
				"isolate flex items-center justify-between gap-x-2 px-(--container-padding,--spacing(4)) py-2.5 text-navbar-fg sm:justify-start sm:px-(--gutter,--spacing(4)) md:inline-full",
				isSticky && "static inset-bs-0 z-40 group-has-data-[intent=default]/sidebar-root:sticky",
				className,
			)}
			data-slot="sidebar-nav"
			{...props}
		/>
	);
}

interface SidebarMenuTriggerProps extends AriaButtonProps {
	alwaysVisible?: boolean;
}

export function SidebarMenuTrigger(props: Readonly<SidebarMenuTriggerProps>): ReactNode {
	const { alwaysVisible = false, className, ...rest } = props;

	return (
		<AriaButton
			className={cx(
				!alwaysVisible &&
					"text-muted-fg opacity-0 pressed:text-fg pressed:opacity-100 hover:text-fg",
				"absolute inset-e-0 flex block-full inline-[calc(var(--sidebar-width)-90%)] items-center justify-end pe-2.5 outline-hidden",
				// eslint-disable-next-line better-tailwindcss/enforce-consistent-class-order
				"sm:[&_[data-slot='icon']:not([class*='size-'])]:block-4 sm:[&_[data-slot='icon']:not([class*='size-'])]:inline-4 [&_[data-slot='icon']:not([class*='size-'])]:block-5 [&_[data-slot='icon']:not([class*='size-'])]:inline-5 pressed:[&_[data-slot='icon']:not([class*='text-'])]:text-fg **:data-[slot=icon]:shrink-0",
				"group-hover/sidebar-item:opacity-100 group-focus-visible/sidebar-item:opacity-100 group/sidebar-item:pressed:opacity-100",
				"group-hover/tree-item:opacity-100 group-focus-visible/tree-item:opacity-100 group/tree-item:pressed:opacity-100",
				className,
			)}
			{...rest}
		/>
	);
}

export interface SidebarTreeProps<T extends object> extends AriaTreeProps<T> {}

export function SidebarTree<T extends object>(props: Readonly<SidebarTreeProps<T>>): ReactNode {
	const { className, selectionMode = "none", ...rest } = props;

	return (
		<AriaTree
			className={cx(
				"col-span-full flex inline-full min-inline-0 cursor-default flex-col gap-y-0.5 p-4 outline-hidden forced-color-adjust-none in-data-[state=collapsed]:p-2",
				className,
			)}
			selectionMode={selectionMode}
			{...rest}
		/>
	);
}

export interface SidebarTreeItemProps<T extends object> extends AriaTreeItemProps<T> {}

export function SidebarTreeItem<T extends object>({
	className,
	...props
}: Readonly<SidebarTreeItemProps<T>>): ReactNode {
	return (
		<AriaTreeItem
			className={cx(
				"min-inline-0 shrink-0 cursor-default select-none outline-hidden",
				"href" in props && "cursor-pointer",
				className,
			)}
			{...props}
		/>
	);
}

export interface SidebarTreeContentProps extends AriaTreeItemContentProps {
	className?: string;
	isCurrent?: boolean;
}

export function SidebarTreeContent(props: Readonly<SidebarTreeContentProps>): ReactNode {
	const { className, isCurrent, children, ...rest } = props;

	return (
		<AriaTreeItemContent data-slot="sidebar-item-content" {...rest}>
			{(values) => (
				<div className="relative flex inline-full min-inline-0 items-center">
					<div
						aria-hidden={true}
						className="shrink-0"
						style={{
							width: `calc((var(--tree-item-level) - 1) * 1.25rem)`,
						}}
					/>
					<div
						className={twMerge(
							"group/tree-item flex min-inline-0 flex-1 items-center gap-x-2 rounded-lg p-2 font-medium text-base/6 text-sidebar-fg sm:text-sm/5",
							// eslint-disable-next-line better-tailwindcss/enforce-consistent-class-order
							"**:data-[slot=icon]:-mx-0.5 **:data-[slot=icon]:shrink-0 [&_[data-slot='icon']:not([class*='size-'])]:block-5 [&_[data-slot='icon']:not([class*='size-'])]:inline-5 [&_[data-slot='icon']:not([class*='text-'])]:text-muted-fg sm:[&_[data-slot='icon']:not([class*='size-'])]:block-4 sm:[&_[data-slot='icon']:not([class*='size-'])]:inline-4",
							"hover:bg-sidebar-accent hover:text-sidebar-accent-fg hover:[&_[data-slot='icon']:not([class*='text-'])]:text-sidebar-accent-fg",
							"[--sidebar-current-bg:var(--color-sidebar-primary)] [--sidebar-current-fg:var(--color-sidebar-primary-fg)]",
							values.isFocusVisible && "inset-ring inset-ring-sidebar-ring",
							values.isPressed &&
								"bg-sidebar-accent text-sidebar-accent-fg [&_[data-slot='icon']:not([class*='text-'])]:text-sidebar-accent-fg",
							isCurrent === true &&
								"font-medium text-(--sidebar-current-fg) hover:bg-(--sidebar-current-bg) hover:text-(--sidebar-current-fg) hover:[&_[data-slot='icon']:not([class*='text-'])]:text-(--sidebar-current-fg) [&_.text-muted-fg]:text-fg/80 [&_[data-slot='icon']:not([class*='text-'])]:text-(--sidebar-current-fg)",
							values.isDisabled && "opacity-50",
							className,
						)}
					>
						{values.hasChildItems && (
							<TreeIndicator
								values={{
									isDisabled: values.isDisabled,
									isExpanded: values.isExpanded,
								}}
							/>
						)}
						{typeof children === "function" ? children(values) : children}
					</div>
				</div>
			)}
		</AriaTreeItemContent>
	);
}
