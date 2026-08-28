"use client";

import { Button } from "@dariah-eric/ui/button";
import { Checkbox } from "@dariah-eric/ui/checkbox";
import { Link } from "@dariah-eric/ui/link";
import { ModalClose, ModalContent, ModalFooter, ModalHeader } from "@dariah-eric/ui/modal";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@dariah-eric/ui/table";
import { AlertTriangleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useState, useTransition } from "react";
import type { Selection } from "react-aria-components";

import { Paginate } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/paginate";
import { cleanRichTextAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/clean-richtext.action";
import { useClientPagination } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/use-client-pagination";
import type { CleanRichTextResult, RichTextCleanupBlock } from "@/lib/data/richtext-cleanup";
import { getEntityDetailHref } from "@/lib/entity-detail-href";
import { useRouter } from "@/lib/navigation/navigation";

interface RichTextCleanupProps {
	blocks: Array<RichTextCleanupBlock>;
}

function humanizeType(value: string): string {
	return value.replaceAll("_", " ");
}

export function RichTextCleanup(props: Readonly<RichTextCleanupProps>): ReactNode {
	const { blocks } = props;

	const t = useExtracted();
	const router = useRouter();

	const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(new Set());
	const visibleBlocks = blocks.filter((block) => !removedIds.has(block.contentBlockId));

	const [selected, setSelected] = useState<Selection>(() => new Set());
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [result, setResult] = useState<CleanRichTextResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	const rows = visibleBlocks.map((block) => {
		return { ...block, id: block.contentBlockId };
	});

	// Selection persists across pages, so normalise to an explicit set of ids we can measure and
	// clean. The `"all"` sentinel only arises from a keyboard select-all over the current page.
	const selectedIds = selected === "all" ? new Set(rows.map((row) => row.id)) : selected;

	const allSelected = rows.length > 0 && selectedIds.size === rows.length;

	const { page, pageItems, perPage, setPage, totalItems, totalPages } = useClientPagination(rows);

	function toggleAll(isSelected: boolean) {
		setSelected(isSelected ? new Set(rows.map((row) => row.id)) : new Set());
	}

	function confirmClean() {
		const ids = Array.from(selectedIds, String);
		setError(null);

		startTransition(async () => {
			try {
				const cleanResult = await cleanRichTextAction(ids);
				const cleanedIds = ids.filter((id) => !cleanResult.skippedIds.includes(id));
				setRemovedIds((current) => new Set([...current, ...cleanedIds]));
				setResult(cleanResult);
				setSelected(new Set());
				setIsConfirmOpen(false);
				router.refresh();
			} catch {
				setError(t("Could not normalise the selected content blocks. Please try again."));
			}
		});
	}

	if (visibleBlocks.length === 0) {
		return (
			<div className="my-8 text-sm text-balance text-muted-fg">
				{result != null && result.cleanedCount > 0
					? t("Normalised {count} content blocks.", { count: String(result.cleanedCount) })
					: t("No rich-text content needs normalising.")}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-y-(--layout-padding)">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Checkbox isSelected={allSelected} onChange={toggleAll}>
					{t("{count} content blocks to normalise", { count: String(visibleBlocks.length) })}
				</Checkbox>

				<Button
					intent="warning"
					isDisabled={selectedIds.size === 0 || isPending}
					onPress={() => {
						setIsConfirmOpen(true);
					}}
				>
					{selectedIds.size > 0
						? t("Normalise selected ({count})", { count: String(selectedIds.size) })
						: t("Normalise selected")}
				</Button>
			</div>

			{result != null && result.skippedIds.length > 0 ? (
				<p
					className="flex items-center gap-x-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-subtle-fg"
					role="alert"
				>
					<AlertTriangleIcon aria-hidden={true} className="shrink-0 block-4 inline-4" />
					{t("{skipped} blocks were skipped (no longer changed).", {
						skipped: String(result.skippedIds.length),
					})}
				</p>
			) : null}

			<Table
				aria-label={t("Rich-text to normalise")}
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
				onSelectionChange={setSelected}
				selectedKeys={selected}
				selectionBehavior="toggle"
				selectionMode="multiple"
			>
				<TableHeader>
					<TableColumn id="entity" isRowHeader={true}>
						{t("Entity")}
					</TableColumn>
					<TableColumn id="type">{t("Type")}</TableColumn>
					<TableColumn id="field">{t("Field")}</TableColumn>
					<TableColumn id="block">{t("Block")}</TableColumn>
					<TableColumn id="status">{t("Status")}</TableColumn>
				</TableHeader>
				<TableBody items={pageItems}>
					{(block) => {
						const href = getEntityDetailHref({
							entityType: block.entityType,
							slug: block.entitySlug,
						});
						const label = block.entityLabel ?? block.entitySlug;

						return (
							<TableRow id={block.id}>
								<TableCell>
									{href != null ? (
										<Link className="underline" href={href}>
											{label}
										</Link>
									) : (
										label
									)}
								</TableCell>
								<TableCell>{humanizeType(block.entityType)}</TableCell>
								<TableCell>{humanizeType(block.fieldName)}</TableCell>
								<TableCell>{humanizeType(block.blockType)}</TableCell>
								<TableCell>{humanizeType(block.status)}</TableCell>
							</TableRow>
						);
					}}
				</TableBody>
			</Table>

			{totalItems > perPage ? (
				<Paginate
					page={page}
					perPage={perPage}
					setPage={setPage}
					total={totalPages}
					totalItems={totalItems}
				/>
			) : null}

			<ModalContent
				isOpen={isConfirmOpen}
				onOpenChange={(open) => {
					if (!open && !isPending) {
						setIsConfirmOpen(false);
					}
				}}
			>
				<ModalHeader
					title={t("Normalise {count} content blocks", { count: String(selectedIds.size) })}
					description={t(
						"This rewrites the rich text of {count} content blocks to remove empty paragraphs, stray line breaks, non-breaking spaces, imported HTML attributes, and bold headings. This action cannot be undone.",
						{ count: String(selectedIds.size) },
					)}
				/>
				{error != null ? (
					<div className="px-6 pbe-2">
						<p
							className="flex items-center gap-x-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
							role="alert"
						>
							<AlertTriangleIcon aria-hidden={true} className="shrink-0 block-4 inline-4" />
							{error}
						</p>
					</div>
				) : null}
				<ModalFooter>
					<ModalClose isDisabled={isPending}>{t("Cancel")}</ModalClose>
					<Button intent="warning" isPending={isPending} onPress={confirmClean}>
						{isPending ? (
							<Fragment>
								<ProgressCircle aria-label={t("Normalising...")} isIndeterminate={true} />
								<span aria-hidden={true}>{t("Normalising...")}</span>
							</Fragment>
						) : (
							t("Normalise")
						)}
					</Button>
				</ModalFooter>
			</ModalContent>
		</div>
	);
}
