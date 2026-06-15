"use client";

import { ChevronDownIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { useExtracted } from "next-intl";
import { type ReactNode, type Ref, createContext, use } from "react";
import {
	Button as AriaButton,
	Cell as AriaCell,
	type CellProps as AriaCellProps,
	Collection as AriaCollection,
	Column as AriaColumn,
	type ColumnProps as AriaColumnProps,
	ColumnResizer as AriaColumnResizer,
	type ColumnResizerProps as AriaColumnResizerProps,
	type TableHeaderProps as AriaHeaderProps,
	ResizableTableContainer as AriaResizableTableContainer,
	Row as AriaRow,
	type RowProps as AriaRowProps,
	Table as AriaTable,
	TableBody as AriaTableBody,
	type TableBodyProps as AriaTableBodyProps,
	TableHeader as AriaTableHeader,
	type TableProps as AriaTableProps,
	composeRenderProps,
	useTableOptions,
} from "react-aria-components";
import { twJoin, twMerge } from "tailwind-merge";

import { Checkbox } from "@/lib/checkbox";
import { EmptyState } from "@/lib/empty-state";
import { cx } from "@/lib/primitive";

export interface TableProps extends Omit<AriaTableProps, "className"> {
	allowResize?: boolean;
	className?: string;
	bleed?: boolean;
	grid?: boolean;
	striped?: boolean;
	ref?: Ref<HTMLTableElement>;
}

const TableContext = createContext<TableProps>({
	allowResize: false,
});

function useTableContext(): TableProps {
	return use(TableContext);
}

function Root(props: Readonly<TableProps>): ReactNode {
	return (
		<AriaTable
			className="inline-full min-inline-full caption-bottom text-sm/6 outline-hidden [--table-selected-bg:var(--color-secondary)]/50"
			{...props}
		/>
	);
}

export function Table(props: Readonly<TableProps>): ReactNode {
	const {
		allowResize,
		className,
		bleed = true,
		grid = false,
		striped = false,
		ref,
		...rest
	} = props;

	return (
		// eslint-disable-next-line @eslint-react/no-unstable-context-value
		<TableContext value={{ allowResize, bleed, grid, striped }}>
			<div className="flow-root">
				<div
					className={twMerge(
						"relative -mx-(--gutter) overflow-x-auto whitespace-nowrap [--gutter-y:--spacing(2)] has-data-[slot=table-resizable-container]:overflow-auto",
						className,
					)}
				>
					<div
						className={twJoin(
							"inline-block min-inline-full align-middle",
							!bleed && "sm:px-(--gutter)",
						)}
					>
						{allowResize === true ? (
							<AriaResizableTableContainer data-slot="table-resizable-container">
								<Root {...rest} ref={ref} />
							</AriaResizableTableContainer>
						) : (
							<Root {...rest} ref={ref} />
						)}
					</div>
				</div>
			</div>
		</TableContext>
	);
}

function ColumnResizer(props: Readonly<AriaColumnResizerProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<AriaColumnResizer
			{...rest}
			className={cx(
				"absolute inset-y-0 inset-e-0 grid inline-px touch-none place-content-center px-1 resizable-both:cursor-ew-resize [data-resizable-direction=left]:cursor-e-resize [data-resizable-direction=right]:cursor-w-resize [&[data-resizing]>div]:bg-primary",
				className,
			)}
		>
			<div className="block-full inline-px bg-border py-(--gutter-y)" />
		</AriaColumnResizer>
	);
}

export interface TableBodyProps<T extends object> extends AriaTableBodyProps<T> {}

export function TableBody<T extends object>(props: Readonly<TableBodyProps<T>>): ReactNode {
	return (
		<AriaTableBody data-slot="table-body" renderEmptyState={() => <EmptyState />} {...props} />
	);
}

export interface TableColumnProps extends AriaColumnProps {
	isResizable?: boolean;
}

export function TableColumn(props: Readonly<TableColumnProps>): ReactNode {
	const { className, children, isResizable = false, ...rest } = props;

	const { bleed, grid } = useTableContext();

	return (
		<AriaColumn
			data-slot="table-column"
			{...rest}
			className={cx(
				[
					"text-start font-medium text-muted-fg",
					"relative outline-hidden allows-sorting:cursor-default dragging:cursor-grabbing",
					"px-4 py-(--gutter-y)",
					"first:ps-(--gutter,--spacing(2)) last:pe-(--gutter,--spacing(2))",
					bleed !== true && "sm:last:pe-1 sm:first:ps-1",
					grid === true && "border-s first:border-s-0",
					isResizable && "overflow-hidden truncate",
				],
				className,
			)}
		>
			{(values) => {
				const isSorted = values.sortDirection != null;

				return (
					<div
						className={twJoin([
							"inline-flex items-center gap-2 **:data-[slot=icon]:shrink-0",
							isSorted ? "text-fg" : values.isHovered ? "text-fg/90" : "",
						])}
					>
						<span className={twJoin([isSorted ? "text-fg" : ""])}>
							{typeof children === "function" ? children(values) : children}
						</span>
						{values.allowsSorting && (
							<span
								className={twJoin(
									"grid block-[1.15rem] inline-[1.15rem] flex-none shrink-0 place-content-center rounded-sm ring-1 ring-transparent *:data-[slot=icon]:block-3.5 *:data-[slot=icon]:inline-3.5 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:transition-transform *:data-[slot=icon]:duration-200",
									isSorted
										? "bg-primary/10 text-primary ring-primary/15"
										: values.isHovered
											? "bg-secondary-fg/10 text-fg/70"
											: "bg-transparent text-muted-fg/60",
								)}
							>
								{isSorted ? (
									<ChevronDownIcon
										className={values.sortDirection === "ascending" ? "rotate-180" : ""}
									/>
								) : (
									<ChevronUpDownIcon />
								)}
							</span>
						)}
						{isResizable && <ColumnResizer />}
					</div>
				);
			}}
		</AriaColumn>
	);
}

export interface TableHeaderProps<T extends object> extends AriaHeaderProps<T> {
	ref?: Ref<HTMLTableSectionElement>;
}

export function TableHeader<T extends object>(props: Readonly<TableHeaderProps<T>>): ReactNode {
	const { children, ref, columns, className, ...rest } = props;

	const { bleed } = useTableContext();
	const { selectionBehavior, selectionMode, allowsDragging } = useTableOptions();

	return (
		<AriaTableHeader
			{...rest}
			ref={ref}
			className={cx("border-be bg-secondary/50", className)}
			data-slot="table-header"
		>
			{allowsDragging && (
				<AriaColumn
					className={twMerge(
						"first:ps-(--gutter,--spacing(2))",
						bleed !== true && "sm:last:pe-1 sm:first:ps-1",
					)}
					data-slot="table-column"
				/>
			)}
			{selectionBehavior === "toggle" && (
				<AriaColumn
					className={twMerge(
						"first:ps-(--gutter,--spacing(2))",
						bleed !== true && "sm:last:pe-1 sm:first:ps-1",
					)}
					data-slot="table-column"
				>
					{selectionMode === "multiple" && <Checkbox slot="selection" />}
				</AriaColumn>
			)}
			<AriaCollection items={columns}>{children}</AriaCollection>
		</AriaTableHeader>
	);
}

export interface TableRowProps<T extends object> extends AriaRowProps<T> {
	ref?: Ref<HTMLTableRowElement>;
	href?: string;
}

export function TableRow<T extends object>(props: Readonly<TableRowProps<T>>): ReactNode {
	const { children, className, columns, id, onAction, href, ref, ...rest } = props;

	const t = useExtracted("ui");

	const { selectionBehavior, allowsDragging } = useTableOptions();
	const { striped } = useTableContext();

	return (
		<AriaRow
			{...rest}
			ref={ref}
			className={composeRenderProps(
				className,
				(
					className,
					{
						isSelected,
						selectionMode,
						isFocusVisibleWithin,
						isDragging,
						isDisabled,
						isFocusVisible,
					},
				) =>
					twMerge(
						"group relative cursor-default text-muted-fg outline outline-transparent",
						isFocusVisible &&
							"bg-primary/5 outline-primary ring-3 ring-ring/20 hover:bg-primary/10",
						isDragging === true && "cursor-grabbing bg-primary/10 text-fg outline-primary",
						isSelected && "bg-(--table-selected-bg) text-fg hover:bg-(--table-selected-bg)/50",
						striped === true && "even:bg-muted",
						// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
						(href ?? onAction ?? selectionMode === "multiple") &&
							"hover:bg-(--table-selected-bg) hover:text-fg",
						// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
						(href ?? onAction ?? selectionMode === "multiple") &&
							isFocusVisibleWithin &&
							"bg-(--table-selected-bg)/50 text-fg selected:bg-(--table-selected-bg)/50",
						isDisabled && "opacity-50",
						className,
					),
			)}
			data-slot="table-row"
			href={href}
			id={id}
		>
			{allowsDragging && (
				<TableCell className="px-0">
					<AriaButton
						aria-label={t("Reorder row")}
						className="grid place-content-center rounded-xs px-[calc(var(--gutter)/2)] outline-hidden focus-visible:ring focus-visible:ring-ring"
						slot="drag"
					>
						<svg
							aria-hidden={true}
							// eslint-disable-next-line better-tailwindcss/no-unknown-classes
							className="lucide lucide-grip-vertical-icon lucide-grip-vertical"
							data-slot="icon"
							fill="none"
							height={16}
							stroke="currentColor"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							viewBox="0 0 24 24"
							width={16}
							xmlns="http://www.w3.org/2000/svg"
						>
							<circle cx={9} cy={12} r={1} />
							<circle cx={9} cy={5} r={1} />
							<circle cx={9} cy={19} r={1} />
							<circle cx={15} cy={12} r={1} />
							<circle cx={15} cy={5} r={1} />
							<circle cx={15} cy={19} r={1} />
						</svg>
					</AriaButton>
				</TableCell>
			)}
			{selectionBehavior === "toggle" && (
				<TableCell className="px-0">
					<Checkbox slot="selection" />
				</TableCell>
			)}
			<AriaCollection items={columns}>{children}</AriaCollection>
		</AriaRow>
	);
}

export interface TableCellProps extends AriaCellProps {
	ref?: Ref<HTMLTableCellElement>;
}

export function TableCell(props: Readonly<TableCellProps>): ReactNode {
	const { className, ref, ...rest } = props;

	const { allowResize, bleed, grid, striped } = useTableContext();

	return (
		<AriaCell
			ref={ref}
			data-slot="table-cell"
			{...rest}
			className={cx(
				twJoin(
					"group px-4 py-(--gutter-y) align-middle outline-hidden first:ps-(--gutter,--spacing(2)) last:pe-(--gutter,--spacing(2)) group-has-data-focus-visible-within:text-fg",
					striped !== true && "border-be",
					grid === true && "border-s first:border-s-0",
					bleed !== true && "sm:last:pe-1 sm:first:ps-1",
					allowResize === true && "overflow-hidden truncate",
				),
				className,
			)}
		/>
	);
}
