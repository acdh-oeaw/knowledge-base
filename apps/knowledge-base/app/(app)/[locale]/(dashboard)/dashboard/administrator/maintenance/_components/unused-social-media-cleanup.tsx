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
import { deleteUnusedSocialMediaAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/delete-unused-social-media.action";
import { useClientPagination } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/use-client-pagination";
import type {
	DeleteUnusedSocialMediaResult,
	UnusedSocialMedia,
} from "@/lib/data/social-media-cleanup";
import { useRouter } from "@/lib/navigation/navigation";

interface UnusedSocialMediaCleanupProps {
	items: Array<UnusedSocialMedia>;
}

function humanizeType(value: string): string {
	return value.replaceAll("_", " ");
}

export function UnusedSocialMediaCleanup(
	props: Readonly<UnusedSocialMediaCleanupProps>,
): ReactNode {
	const { items } = props;

	const t = useExtracted();
	const router = useRouter();

	const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(new Set());
	const visibleItems = items.filter((item) => !removedIds.has(item.id));

	const [selected, setSelected] = useState<Selection>(() => new Set());
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [result, setResult] = useState<DeleteUnusedSocialMediaResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Selection persists across pages, so normalise to an explicit set of ids we can measure and
	// delete. The `"all"` sentinel only arises from a keyboard select-all over the current page.
	const selectedIds = selected === "all" ? new Set(visibleItems.map((item) => item.id)) : selected;

	const allSelected = visibleItems.length > 0 && selectedIds.size === visibleItems.length;

	const { page, pageItems, perPage, setPage, totalItems, totalPages } =
		useClientPagination(visibleItems);

	function toggleAll(isSelected: boolean) {
		setSelected(isSelected ? new Set(visibleItems.map((item) => item.id)) : new Set());
	}

	function confirmDelete() {
		const ids = Array.from(selectedIds, String);
		setError(null);

		startTransition(async () => {
			try {
				const deleteResult = await deleteUnusedSocialMediaAction(ids);
				const deletedIds = ids.filter((id) => !deleteResult.skippedIds.includes(id));
				setRemovedIds((current) => new Set([...current, ...deletedIds]));
				setResult(deleteResult);
				setSelected(new Set());
				setIsConfirmOpen(false);
				router.refresh();
			} catch {
				setError(t("Could not delete the selected social-media entries. Please try again."));
			}
		});
	}

	if (visibleItems.length === 0) {
		return (
			<div className="my-8 text-sm text-balance text-muted-fg">
				{result != null && result.deletedCount > 0
					? t("Deleted {count} unused social-media entries.", {
							count: String(result.deletedCount),
						})
					: t("No unused social-media entries found.")}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-y-(--layout-padding)">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Checkbox isSelected={allSelected} onChange={toggleAll}>
					{t("{count} unused social-media entries", { count: String(visibleItems.length) })}
				</Checkbox>

				<Button
					intent="danger"
					isDisabled={selectedIds.size === 0 || isPending}
					onPress={() => {
						setIsConfirmOpen(true);
					}}
				>
					{selectedIds.size > 0
						? t("Delete selected ({count})", { count: String(selectedIds.size) })
						: t("Delete selected")}
				</Button>
			</div>

			{result != null && result.skippedIds.length > 0 ? (
				<p
					className="flex items-center gap-x-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-subtle-fg"
					role="alert"
				>
					<AlertTriangleIcon aria-hidden={true} className="shrink-0 block-4 inline-4" />
					{t("{skipped} entries were skipped (no longer unused).", {
						skipped: String(result.skippedIds.length),
					})}
				</p>
			) : null}

			<Table
				aria-label={t("Unused social media")}
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
				onSelectionChange={setSelected}
				selectedKeys={selected}
				selectionBehavior="toggle"
				selectionMode="multiple"
			>
				<TableHeader>
					<TableColumn className="max-inline-80" id="name" isRowHeader={true}>
						{t("Name")}
					</TableColumn>
					<TableColumn id="type">{t("Type")}</TableColumn>
					<TableColumn id="url">{t("URL")}</TableColumn>
				</TableHeader>
				<TableBody items={pageItems}>
					{(item) => (
						<TableRow id={item.id}>
							<TableCell>
								<div className="truncate max-inline-80" title={item.name}>
									{item.name}
								</div>
							</TableCell>
							<TableCell>{humanizeType(item.type)}</TableCell>
							<TableCell>
								<Link className="underline" href={item.url} target="_blank">
									{item.url}
								</Link>
							</TableCell>
						</TableRow>
					)}
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
					title={t("Delete {count} unused social-media entries", {
						count: String(selectedIds.size),
					})}
					description={t(
						"This permanently removes {count} social-media entries from the database. This action cannot be undone.",
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
					<Button intent="danger" isPending={isPending} onPress={confirmDelete}>
						{isPending ? (
							<Fragment>
								<ProgressCircle aria-label={t("Deleting...")} isIndeterminate={true} />
								<span aria-hidden={true}>{t("Deleting...")}</span>
							</Fragment>
						) : (
							t("Delete")
						)}
					</Button>
				</ModalFooter>
			</ModalContent>
		</div>
	);
}
