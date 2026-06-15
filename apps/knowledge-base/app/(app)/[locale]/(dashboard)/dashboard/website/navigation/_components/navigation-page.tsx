"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { Button } from "@acdh-knowledge-base/ui/button";
import { Tab, TabList, TabPanel, Tabs } from "@acdh-knowledge-base/ui/tabs";
import { Tooltip, TooltipContent } from "@acdh-knowledge-base/ui/tooltip";
import {
	ChevronDownIcon,
	ChevronRightIcon,
	ChevronUpIcon,
	PencilSquareIcon,
	PlusIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, startTransition, useState, useTransition } from "react";

import {
	EntityDeleteModal,
	EntityListHeader,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import {
	type EntityOption,
	NavigationItemFormDialog,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/website/navigation/_components/navigation-item-form-dialog";
import { NavigationMenuCreateDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/navigation/_components/navigation-menu-create-dialog";
import { deleteNavigationItemAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/navigation/_lib/delete-navigation-item.action";
import { deleteNavigationMenuAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/navigation/_lib/delete-navigation-menu.action";
import { moveNavigationItemAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/navigation/_lib/move-navigation-item.action";

export type NavigationItemWithChildren = Pick<
	schema.NavigationItem,
	"id" | "menuId" | "parentId" | "label" | "href" | "entityId" | "isExternal" | "position"
> & { entityTitle?: string | null };

export interface NavigationMenuWithItems extends Pick<schema.NavigationMenu, "id" | "name"> {
	items: Array<NavigationItemWithChildren>;
}

interface NavigationPageProps {
	menus: Array<NavigationMenuWithItems>;
	entities: Array<EntityOption>;
}

interface TreeNode extends NavigationItemWithChildren {
	children: Array<TreeNode>;
}

function buildTree(
	items: Array<NavigationItemWithChildren>,
	parentId: string | null,
): Array<TreeNode> {
	return items
		.filter((item) => item.parentId === parentId)

		.toSorted((a, b) => a.position - b.position)
		.map((item) => {
			return {
				...item,
				children: buildTree(items, item.id),
			};
		});
}

interface ItemRowProps {
	node: TreeNode;
	depth: number;
	isFirst: boolean;
	isLast: boolean;
	menuId: string;
	entities: Array<EntityOption>;
	onEditItem: (item: NavigationItemWithChildren) => void;
	onDeleteItem: (id: string) => void;
	onAddChild: (parentId: string) => void;
	onMoveItem: (id: string, direction: "up" | "down") => void;
}

function ItemRow(props: Readonly<ItemRowProps>): ReactNode {
	const { node, depth, isFirst, isLast, onEditItem, onDeleteItem, onAddChild, onMoveItem } = props;

	const t = useExtracted();

	const linkDescription = node.entityTitle ?? node.href ?? null;

	return (
		<Fragment>
			<div
				className="flex items-center gap-x-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
				style={{ paddingLeft: `${String((depth + 1) * 1.25)}rem` }}
			>
				{depth > 0 && <ChevronRightIcon className="text-muted-fg me-1 block-3 inline-3 shrink-0" />}

				<div className="min-inline-0 flex-1">
					<span className="text-sm font-medium">{node.label}</span>
					{linkDescription != null && (
						<span className="text-muted-fg ms-2 truncate text-xs">{linkDescription}</span>
					)}
				</div>

				<div className="flex shrink-0 items-center gap-x-1">
					<Tooltip>
						<Button
							aria-label={t("Move up")}
							intent="plain"
							isDisabled={isFirst}
							onPress={() => {
								onMoveItem(node.id, "up");
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
								onMoveItem(node.id, "down");
							}}
							size="sq-sm"
						>
							<ChevronDownIcon className="block-4 inline-4" />
						</Button>
						<TooltipContent inverse={true}>{t("Move down")}</TooltipContent>
					</Tooltip>
					<Button
						intent="plain"
						onPress={() => {
							onAddChild(node.id);
						}}
						size="sm"
					>
						<PlusIcon className="me-1 block-3.5 inline-3.5" />
						{t("Add child")}
					</Button>
					<Tooltip>
						<Button
							aria-label={t("Edit")}
							intent="plain"
							onPress={() => {
								onEditItem(node);
							}}
							size="sq-sm"
						>
							<PencilSquareIcon className="block-4 inline-4" />
						</Button>
						<TooltipContent inverse={true}>{t("Edit")}</TooltipContent>
					</Tooltip>
					<Tooltip>
						<Button
							aria-label={t("Delete")}
							intent="plain"
							onPress={() => {
								onDeleteItem(node.id);
							}}
							size="sq-sm"
						>
							<TrashIcon className="block-4 inline-4 text-danger" />
						</Button>
						<TooltipContent inverse={true}>{t("Delete")}</TooltipContent>
					</Tooltip>
				</div>
			</div>

			{node.children.map((child, index) => {
				const { entities, menuId } = props;
				const { id } = child;

				return (
					<ItemRow
						key={id}
						depth={depth + 1}
						entities={entities}
						isFirst={index === 0}
						isLast={index === node.children.length - 1}
						menuId={menuId}
						node={child}
						onAddChild={onAddChild}
						onDeleteItem={onDeleteItem}
						onEditItem={onEditItem}
						onMoveItem={onMoveItem}
					/>
				);
			})}
		</Fragment>
	);
}

interface MenuTabPanelProps {
	menu: NavigationMenuWithItems;
	entities: Array<EntityOption>;
}

function MenuTabPanel(props: Readonly<MenuTabPanelProps>): ReactNode {
	const { menu, entities } = props;

	const t = useExtracted();

	const tree = buildTree(menu.items, null);

	const [itemDialogState, setItemDialogState] = useState<{
		isOpen: boolean;
		item?: NavigationItemWithChildren | null;
		parentId?: string | null;
	}>({ isOpen: false });

	const [itemToDelete, setItemToDelete] = useState<string | null>(null);
	const [deleteItemError, setDeleteItemError] = useState<string | null>(null);
	const [isDeleteItemPending, startDeleteItemTransition] = useTransition();

	return (
		<Fragment>
			<div className="flex flex-col gap-y-1">
				{tree.length === 0 ? (
					<p className="text-muted-fg px-2 py-4 text-sm">{t("No items yet.")}</p>
				) : (
					tree.map((node, index) => (
						<ItemRow
							key={node.id}
							depth={0}
							entities={entities}
							isFirst={index === 0}
							isLast={index === tree.length - 1}
							menuId={menu.id}
							node={node}
							onAddChild={(parentId) => {
								setItemDialogState({ isOpen: true, parentId });
							}}
							onDeleteItem={(id) => {
								setItemToDelete(id);
							}}
							onEditItem={(item) => {
								setItemDialogState({ isOpen: true, item });
							}}
							onMoveItem={(id, direction) => {
								startTransition(async () => {
									await moveNavigationItemAction(id, direction);
								});
							}}
						/>
					))
				)}
			</div>

			<div className="mbs-4">
				<Button
					intent="secondary"
					onPress={() => {
						setItemDialogState({ isOpen: true, parentId: null });
					}}
					size="sm"
				>
					<PlusIcon className="me-2 block-4 inline-4" />
					{t("Add item")}
				</Button>
			</div>

			<NavigationItemFormDialog
				entities={entities}
				isOpen={itemDialogState.isOpen}
				item={itemDialogState.item}
				menuId={menu.id}
				onOpenChange={(open) => {
					setItemDialogState((prev) => {
						return { ...prev, isOpen: open };
					});
				}}
				parentId={itemDialogState.parentId}
			/>

			<EntityDeleteModal
				item={itemToDelete != null ? { id: itemToDelete } : null}
				model={t("navigation item")}
				isPending={isDeleteItemPending}
				error={deleteItemError}
				onClose={() => {
					setItemToDelete(null);
					setDeleteItemError(null);
				}}
				onConfirm={() => {
					if (itemToDelete == null) {
						return;
					}
					const id = itemToDelete;
					setDeleteItemError(null);
					startDeleteItemTransition(async () => {
						try {
							await deleteNavigationItemAction(id);
							setItemToDelete(null);
						} catch {
							setDeleteItemError(t("Could not delete navigation item. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}

export function NavigationPage(props: Readonly<NavigationPageProps>): ReactNode {
	const { menus, entities } = props;

	const t = useExtracted();

	const [menuToDelete, setMenuToDelete] = useState<string | null>(null);
	const [deleteMenuError, setDeleteMenuError] = useState<string | null>(null);
	const [isDeleteMenuPending, startDeleteMenuTransition] = useTransition();

	return (
		<Fragment>
			<EntityListHeader
				title={t("Website navigation")}
				description={t("Manage website navigation.")}
				action={<NavigationMenuCreateDialog />}
			/>

			<div className="p-(--layout-padding)">
				{menus.length === 0 ? (
					<p className="text-muted-fg py-8 text-center text-sm">
						{t("No menus yet. Create your first menu to get started.")}
					</p>
				) : (
					<Tabs>
						<TabList aria-label={t("Navigation menus")} className="mbe-4">
							{menus.map((menu) => (
								<Tab key={menu.id} id={menu.id}>
									{menu.name}
								</Tab>
							))}
						</TabList>

						{menus.map((menu) => (
							<TabPanel key={menu.id} id={menu.id}>
								<div className="flex items-center justify-between mbe-4">
									<span className="text-muted-fg text-sm">
										{menu.items.length === 1
											? t("1 item")
											: `${String(menu.items.length)} ${t("items")}`}
									</span>
									<Button
										aria-label={t("Delete menu")}
										intent="plain"
										onPress={() => {
											setMenuToDelete(menu.id);
										}}
										size="sm"
									>
										<TrashIcon className="me-2 block-4 inline-4 text-danger" />
										<span className="text-danger">{t("Delete menu")}</span>
									</Button>
								</div>

								<MenuTabPanel entities={entities} menu={menu} />
							</TabPanel>
						))}
					</Tabs>
				)}
			</div>

			<EntityDeleteModal
				item={menuToDelete != null ? { id: menuToDelete } : null}
				model={t("navigation menu")}
				isPending={isDeleteMenuPending}
				error={deleteMenuError}
				onClose={() => {
					setMenuToDelete(null);
					setDeleteMenuError(null);
				}}
				onConfirm={() => {
					if (menuToDelete == null) {
						return;
					}
					const id = menuToDelete;
					setDeleteMenuError(null);
					startDeleteMenuTransition(async () => {
						try {
							await deleteNavigationMenuAction(id);
							setMenuToDelete(null);
						} catch {
							setDeleteMenuError(t("Could not delete navigation menu. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
