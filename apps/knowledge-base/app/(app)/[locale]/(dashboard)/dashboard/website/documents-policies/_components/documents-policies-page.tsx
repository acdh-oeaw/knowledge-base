"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { Button } from "@acdh-knowledge-base/ui/button";
import { buttonStyles } from "@acdh-knowledge-base/ui/button-styles";
import { Link } from "@acdh-knowledge-base/ui/link";
import { Tooltip, TooltipContent } from "@acdh-knowledge-base/ui/tooltip";
import {
	ChevronDownIcon,
	ChevronUpIcon,
	PencilSquareIcon,
	PlusIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, startTransition, useState, useTransition } from "react";

import { EntityLifecycleStatusBadge } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-status-badge";
import {
	EntityDeleteModal,
	EntityListHeader,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import {
	type DocumentOrPolicyDialogItem,
	DocumentOrPolicyFormDialog,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_components/document-or-policy-form-dialog";
import { DocumentPolicyGroupCreateDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_components/document-policy-group-create-dialog";
import { DocumentPolicyGroupEditDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_components/document-policy-group-edit-dialog";
import { deleteDocumentOrPolicyAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/delete-document-or-policy.action";
import { deleteDocumentPolicyGroupAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/delete-document-policy-group.action";
import { moveDocumentOrPolicyAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/move-document-or-policy.action";
import { moveDocumentPolicyGroupAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/move-document-policy-group.action";

type DocumentItem = Pick<
	schema.DocumentOrPolicy,
	"id" | "title" | "summary" | "url" | "groupId" | "position"
> & {
	entityVersion: { entity: Pick<schema.Entity, "id" | "slug"> };
	hasDraft: boolean;
	isPublished: boolean;
	document: Pick<schema.Asset, "key" | "label">;
};

interface GroupWithDocuments extends Pick<schema.DocumentPolicyGroup, "id" | "label" | "position"> {
	documentsPolicies: Array<DocumentItem>;
}

interface DocumentsPoliciesPageProps {
	groups: Array<GroupWithDocuments>;
	ungrouped: Array<DocumentItem>;
	initialAssets: Array<{ key: string; label: string; url: string }>;
}

interface DocumentRowProps {
	item: DocumentItem;
	isFirst: boolean;
	isLast: boolean;
	onEdit: (item: DocumentOrPolicyDialogItem) => void;
	onDelete: (id: string) => void;
	onMove: (id: string, direction: "up" | "down") => void;
}

function DocumentRow(props: Readonly<DocumentRowProps>): ReactNode {
	const { item, isFirst, isLast, onEdit, onDelete, onMove } = props;

	const t = useExtracted();

	return (
		<div className="flex items-center gap-x-2 rounded-md p-2 hover:bg-muted/50">
			<div className="min-inline-0 flex flex-1 items-center gap-x-2">
				<EntityLifecycleStatusBadge hasDraft={item.hasDraft} isPublished={item.isPublished} />
				<span className="text-sm font-medium">{item.title}</span>
				{item.summary ? (
					<span className="text-muted-fg ms-2 truncate text-xs">{item.summary}</span>
				) : null}
			</div>

			<div className="flex shrink-0 items-center gap-x-1">
				<Tooltip>
					<Button
						aria-label={t("Move up")}
						intent="plain"
						isDisabled={isFirst}
						onPress={() => {
							onMove(item.id, "up");
						}}
						size="sq-sm"
					>
						<ChevronUpIcon className="block-4 inline-4" />
					</Button>
					<TooltipContent inverse={true}>{t("Move up")}</TooltipContent>
				</Tooltip>
				<Tooltip>
					<Button
						aria-label={t("Move down")}
						intent="plain"
						isDisabled={isLast}
						onPress={() => {
							onMove(item.id, "down");
						}}
						size="sq-sm"
					>
						<ChevronDownIcon className="block-4 inline-4" />
					</Button>
					<TooltipContent inverse={true}>{t("Move down")}</TooltipContent>
				</Tooltip>
				<Tooltip>
					<Button
						aria-label={t("Edit")}
						intent="plain"
						onPress={() => {
							onEdit(item);
						}}
						size="sq-sm"
					>
						<PencilSquareIcon className="block-4 inline-4" />
					</Button>
					<TooltipContent inverse={true}>{t("Edit")}</TooltipContent>
				</Tooltip>
				<Tooltip>
					<Link
						aria-label={t("Content")}
						className={buttonStyles({ intent: "plain", size: "sq-sm" })}
						href={`/dashboard/website/documents-policies/${item.entityVersion.entity.slug}/edit`}
					>
						<span className="text-xs">{t("Content")}</span>
					</Link>
					<TooltipContent inverse={true}>{t("Content")}</TooltipContent>
				</Tooltip>
				<Tooltip>
					<Button
						aria-label={t("Delete")}
						intent="plain"
						onPress={() => {
							onDelete(item.entityVersion.entity.id);
						}}
						size="sq-sm"
					>
						<TrashIcon className="block-4 inline-4 text-danger" />
					</Button>
					<TooltipContent inverse={true}>{t("Delete")}</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}

interface DocumentSectionProps {
	label: string;
	groupId: string | null;
	items: Array<DocumentItem>;
	isFirstGroup?: boolean;
	isLastGroup?: boolean;
	groups: Array<Pick<schema.DocumentPolicyGroup, "id" | "label">>;
	initialAssets: Array<{ key: string; label: string; url: string }>;
	onAddDocument: (groupId: string | null) => void;
	onEditDocument: (item: DocumentOrPolicyDialogItem) => void;
	onDeleteDocument: (id: string) => void;
	onMoveDocument: (id: string, direction: "up" | "down") => void;
	onEditGroup?: (group: { id: string; label: string }) => void;
	onMoveGroup?: (id: string, direction: "up" | "down") => void;
	onDeleteGroup?: (id: string) => void;
}

function DocumentSection(props: Readonly<DocumentSectionProps>): ReactNode {
	const {
		label,
		groupId,
		items,
		isFirstGroup,
		isLastGroup,
		onAddDocument,
		onEditDocument,
		onDeleteDocument,
		onMoveDocument,
		onEditGroup,
		onMoveGroup,
		onDeleteGroup,
	} = props;

	const t = useExtracted();

	return (
		<div className="mbe-6">
			<div className="mbe-2 flex items-center gap-x-2 border-be pbe-2">
				<h2 className="flex-1 text-sm font-semibold">{label}</h2>
				{groupId != null && onMoveGroup != null && onDeleteGroup != null && onEditGroup != null && (
					<div className="flex shrink-0 items-center gap-x-1">
						<Tooltip>
							<Button
								aria-label={t("Edit group")}
								intent="plain"
								onPress={() => {
									onEditGroup({ id: groupId, label });
								}}
								size="sq-sm"
							>
								<PencilSquareIcon className="block-4 inline-4" />
							</Button>
							<TooltipContent inverse={true}>{t("Edit group")}</TooltipContent>
						</Tooltip>
						<Tooltip>
							<Button
								aria-label={t("Move group up")}
								intent="plain"
								isDisabled={isFirstGroup}
								onPress={() => {
									onMoveGroup(groupId, "up");
								}}
								size="sq-sm"
							>
								<ChevronUpIcon className="block-4 inline-4" />
							</Button>
							<TooltipContent inverse={true}>{t("Move group up")}</TooltipContent>
						</Tooltip>
						<Tooltip>
							<Button
								aria-label={t("Move group down")}
								intent="plain"
								isDisabled={isLastGroup}
								onPress={() => {
									onMoveGroup(groupId, "down");
								}}
								size="sq-sm"
							>
								<ChevronDownIcon className="block-4 inline-4" />
							</Button>
							<TooltipContent inverse={true}>{t("Move group down")}</TooltipContent>
						</Tooltip>
						<Tooltip>
							<Button
								aria-label={t("Delete group")}
								intent="plain"
								onPress={() => {
									onDeleteGroup(groupId);
								}}
								size="sq-sm"
							>
								<TrashIcon className="block-4 inline-4 text-danger" />
							</Button>
							<TooltipContent inverse={true}>{t("Delete group")}</TooltipContent>
						</Tooltip>
					</div>
				)}
			</div>

			{items.length === 0 ? (
				<p className="text-muted-fg p-2 text-xs">{t("No documents yet.")}</p>
			) : (
				<div className="flex flex-col gap-y-0.5">
					{items.map((item, index) => (
						<DocumentRow
							key={item.id}
							isFirst={index === 0}
							isLast={index === items.length - 1}
							item={item}
							onDelete={onDeleteDocument}
							onEdit={onEditDocument}
							onMove={onMoveDocument}
						/>
					))}
				</div>
			)}

			<div className="mbs-2">
				<Button
					intent="plain"
					onPress={() => {
						onAddDocument(groupId);
					}}
					size="sm"
				>
					<PlusIcon className="me-1 block-3.5 inline-3.5" />
					{t("Add document")}
				</Button>
			</div>
		</div>
	);
}

export function DocumentsPoliciesPage(props: Readonly<DocumentsPoliciesPageProps>): ReactNode {
	const { groups, ungrouped, initialAssets } = props;

	const t = useExtracted();

	const allGroups = groups.map(({ id, label }) => {
		return { id, label };
	});

	const [dialogState, setDialogState] = useState<{
		isOpen: boolean;
		item?: DocumentOrPolicyDialogItem | null;
		initialGroupId?: string | null;
	}>({ isOpen: false });

	const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
	const [documentDeleteError, setDocumentDeleteError] = useState<string | null>(null);
	const [isDocumentDeletePending, startDocumentDeleteTransition] = useTransition();
	const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
	const [groupDeleteError, setGroupDeleteError] = useState<string | null>(null);
	const [isGroupDeletePending, startGroupDeleteTransition] = useTransition();
	const [groupToEdit, setGroupToEdit] = useState<{ id: string; label: string } | null>(null);

	return (
		<Fragment>
			<EntityListHeader
				title={t("Documents and policies")}
				description={t("Manage all documents and policies in the knowledge base.")}
				action={
					<>
						<DocumentPolicyGroupCreateDialog />
						<Button
							intent="secondary"
							onPress={() => {
								setDialogState({ isOpen: true, item: null, initialGroupId: null });
							}}
						>
							<PlusIcon className="me-2 block-4 inline-4" />
							{t("New document")}
						</Button>
					</>
				}
			/>

			<div className="p-(--layout-padding)">
				{groups.map((group, groupIndex) => (
					<DocumentSection
						key={group.id}
						groupId={group.id}
						groups={allGroups}
						initialAssets={initialAssets}
						isFirstGroup={groupIndex === 0}
						isLastGroup={groupIndex === groups.length - 1}
						items={group.documentsPolicies}
						label={group.label}
						onAddDocument={(gid) => {
							setDialogState({ isOpen: true, item: null, initialGroupId: gid });
						}}
						onDeleteDocument={(id) => {
							setDocumentToDelete(id);
						}}
						onDeleteGroup={(id) => {
							setGroupToDelete(id);
						}}
						onEditDocument={(item) => {
							setDialogState({ isOpen: true, item });
						}}
						onEditGroup={(group) => {
							setGroupToEdit(group);
						}}
						onMoveDocument={(id, direction) => {
							startTransition(async () => {
								await moveDocumentOrPolicyAction(id, direction);
							});
						}}
						onMoveGroup={(id, direction) => {
							startTransition(async () => {
								await moveDocumentPolicyGroupAction(id, direction);
							});
						}}
					/>
				))}

				<DocumentSection
					groupId={null}
					groups={allGroups}
					initialAssets={initialAssets}
					items={ungrouped}
					label={t("Ungrouped")}
					onAddDocument={(gid) => {
						setDialogState({ isOpen: true, item: null, initialGroupId: gid });
					}}
					onDeleteDocument={(id) => {
						setDocumentToDelete(id);
					}}
					onEditDocument={(item) => {
						setDialogState({ isOpen: true, item });
					}}
					onMoveDocument={(id, direction) => {
						startTransition(async () => {
							await moveDocumentOrPolicyAction(id, direction);
						});
					}}
				/>
			</div>

			<DocumentPolicyGroupEditDialog
				group={groupToEdit}
				isOpen={groupToEdit != null}
				onOpenChange={(open) => {
					if (!open) {
						setGroupToEdit(null);
					}
				}}
			/>

			<DocumentOrPolicyFormDialog
				groups={allGroups}
				initialAssets={initialAssets}
				initialGroupId={dialogState.initialGroupId}
				isOpen={dialogState.isOpen}
				item={dialogState.item}
				onOpenChange={(open) => {
					setDialogState((prev) => {
						return { ...prev, isOpen: open };
					});
				}}
			/>

			<EntityDeleteModal
				item={documentToDelete != null ? { id: documentToDelete } : null}
				model={t("document or policy")}
				isPending={isDocumentDeletePending}
				error={documentDeleteError}
				onClose={() => {
					setDocumentToDelete(null);
					setDocumentDeleteError(null);
				}}
				onConfirm={() => {
					if (documentToDelete == null) {
						return;
					}
					const id = documentToDelete;
					setDocumentDeleteError(null);
					startDocumentDeleteTransition(async () => {
						try {
							await deleteDocumentOrPolicyAction(id);
							setDocumentToDelete(null);
						} catch {
							setDocumentDeleteError(t("Could not delete document or policy. Please try again."));
						}
					});
				}}
			/>

			<EntityDeleteModal
				item={groupToDelete != null ? { id: groupToDelete } : null}
				model={t("group")}
				isPending={isGroupDeletePending}
				error={groupDeleteError}
				onClose={() => {
					setGroupToDelete(null);
					setGroupDeleteError(null);
				}}
				onConfirm={() => {
					if (groupToDelete == null) {
						return;
					}
					const id = groupToDelete;
					setGroupDeleteError(null);
					startGroupDeleteTransition(async () => {
						try {
							await deleteDocumentPolicyGroupAction(id);
							setGroupToDelete(null);
						} catch {
							setGroupDeleteError(t("Could not delete group. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
