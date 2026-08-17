"use client";

import { Button } from "@dariah-eric/ui/button";
import { buttonStyles } from "@dariah-eric/ui/button-styles";
import { Link } from "@dariah-eric/ui/link";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator } from "@dariah-eric/ui/menu";
import { SearchField, SearchInput } from "@dariah-eric/ui/search-field";
import { EllipsisHorizontalIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import { DeleteModal } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/delete-modal";
import {
	Header,
	HeaderAction,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import { Paginate } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/paginate";

// ---------------------------------------------------------------------------
// EntityListHeader
// ---------------------------------------------------------------------------

interface EntityListHeaderProps {
	title: string;
	description: string;
	action?: ReactNode;
}

export function EntityListHeader(props: Readonly<EntityListHeaderProps>): ReactNode {
	const { title, description, action } = props;

	return (
		<Header>
			<HeaderContent>
				<HeaderTitle>{title}</HeaderTitle>
				<HeaderDescription>{description}</HeaderDescription>
			</HeaderContent>
			{action != null ? <HeaderAction>{action}</HeaderAction> : null}
		</Header>
	);
}

// ---------------------------------------------------------------------------
// NewLink — styled link with PlusIcon, designed to drop into `action`
// ---------------------------------------------------------------------------

interface NewLinkProps {
	href: string;
	children: ReactNode;
}

export function NewLink(props: Readonly<NewLinkProps>): ReactNode {
	const { href, children } = props;

	return (
		<Link className={buttonStyles({ intent: "secondary" })} href={href}>
			<PlusIcon className="me-2 block-4 inline-4" />
			{children}
		</Link>
	);
}

// ---------------------------------------------------------------------------
// EntityListSearchField — SearchField wired to useUrlPaginatedSearch
// ---------------------------------------------------------------------------

interface SearchBinding {
	inputValue: string;
	setInputValue: (value: string) => void;
}

interface EntityListSearchFieldProps {
	search: SearchBinding;
	placeholder?: string;
}

export function EntityListSearchField(props: Readonly<EntityListSearchFieldProps>): ReactNode {
	const { search, placeholder } = props;
	const t = useExtracted();

	return (
		<SearchField onChange={search.setInputValue} value={search.inputValue}>
			<SearchInput placeholder={placeholder ?? t("Search")} />
		</SearchField>
	);
}

// ---------------------------------------------------------------------------
// EntityListPagination — Paginate wired to useUrlPaginatedSearch
// ---------------------------------------------------------------------------

interface PaginationBinding {
	isPending: boolean;
	page: number;
	setPage: (page: number) => void;
}

interface EntityListPaginationProps {
	search: PaginationBinding;
	total: number;
	pageSize: number;
}

export function EntityListPagination(props: Readonly<EntityListPaginationProps>): ReactNode {
	const { search, total, pageSize } = props;
	const totalPages = Math.max(Math.ceil(total / pageSize), 1);

	return (
		<Paginate
			isPending={search.isPending}
			page={search.page}
			setPage={search.setPage}
			total={totalPages}
			totalItems={total}
		/>
	);
}

// ---------------------------------------------------------------------------
// RowActionsMenu — the per-row "..." menu (compound component)
// ---------------------------------------------------------------------------

export function RowActionsMenu({ children }: Readonly<{ children: ReactNode }>): ReactNode {
	const t = useExtracted();

	return (
		<Menu>
			<Button
				aria-label={t("Open actions menu")}
				className="block-7 sm:block-7"
				intent="plain"
				size="sq-sm"
			>
				<EllipsisHorizontalIcon className="block-5 inline-5" />
			</Button>
			<MenuContent placement="left top">{children}</MenuContent>
		</Menu>
	);
}

interface RowActionsMenuLinkProps {
	href: string;
	icon?: ReactNode;
	isDisabled?: boolean;
	children: ReactNode;
}

RowActionsMenu.Link = function RowActionsMenuLink(
	props: Readonly<RowActionsMenuLinkProps>,
): ReactNode {
	const { href, icon, isDisabled, children } = props;

	return (
		<MenuItem href={href} isDisabled={isDisabled}>
			{icon}
			<MenuLabel>{children}</MenuLabel>
		</MenuItem>
	);
};

interface RowActionsMenuActionProps {
	icon?: ReactNode;
	danger?: boolean;
	isDisabled?: boolean;
	onAction: () => void;
	children: ReactNode;
}

RowActionsMenu.Action = function RowActionsMenuAction(
	props: Readonly<RowActionsMenuActionProps>,
): ReactNode {
	const { icon, danger, isDisabled, onAction, children } = props;

	return (
		<MenuItem
			intent={danger === true ? "danger" : undefined}
			isDisabled={isDisabled}
			onAction={onAction}
		>
			{icon}
			<MenuLabel>{children}</MenuLabel>
		</MenuItem>
	);
};

RowActionsMenu.Separator = MenuSeparator;

// ---------------------------------------------------------------------------
// EntityDeleteModal — wraps DeleteModal with the optimistic/error wiring
// ---------------------------------------------------------------------------

interface EntityDeleteModalProps {
	item: { id: string } | null;
	model: string;
	isPending: boolean;
	onConfirm: () => void;
	onClose: () => void;
	/** When provided, the modal stays open while pending and shows the error inline on failure. */
	error?: string | null;
}

export function EntityDeleteModal(props: Readonly<EntityDeleteModalProps>): ReactNode {
	const { item, model, isPending, onConfirm, onClose, error } = props;
	const supportsInlineError = error !== undefined;

	return (
		<DeleteModal
			closeOnAction={!supportsInlineError}
			errorMessage={error}
			isOpen={item != null}
			isPending={isPending}
			model={model}
			onAction={onConfirm}
			onOpenChange={(open) => {
				if (!open && !isPending) {
					onClose();
				}
			}}
		/>
	);
}
