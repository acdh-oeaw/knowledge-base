"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { type ActionState, createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { Button } from "@acdh-knowledge-base/ui/button";
import { Checkbox } from "@acdh-knowledge-base/ui/checkbox";
import { FieldError, Label } from "@acdh-knowledge-base/ui/field";
import { Form } from "@acdh-knowledge-base/ui/form";
import { FormStatus } from "@acdh-knowledge-base/ui/form-status";
import { Input } from "@acdh-knowledge-base/ui/input";
import {
	ModalBody,
	ModalClose,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@acdh-knowledge-base/ui/modal";
import { ProgressCircle } from "@acdh-knowledge-base/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@acdh-knowledge-base/ui/select";
import { Separator } from "@acdh-knowledge-base/ui/separator";
import { TextField } from "@acdh-knowledge-base/ui/text-field";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import { createNavigationItemAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/navigation/_lib/create-navigation-item.action";
import { updateNavigationItemAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/navigation/_lib/update-navigation-item.action";

export const allowedEntityTypes = ["page", "spotlight", "impact-case-study"] as const;
export type EntityType = (typeof allowedEntityTypes)[number];

export interface EntityOption {
	id: string;
	title: string;
	type: EntityType;
}

const entityTypeLabels: Record<EntityType, string> = {
	page: "Page",
	spotlight: "Spotlight article",
	"impact-case-study": "Impact case study",
};

type LinkType = "external" | "internal" | "none";

interface NavigationItemFormProps {
	onSuccess: () => void;
	item?: Pick<schema.NavigationItem, "id" | "label" | "href" | "entityId" | "isExternal"> | null;
	menuId?: string;
	parentId?: string | null;
	entities: Array<EntityOption>;
}

function NavigationItemForm(props: Readonly<NavigationItemFormProps>): ReactNode {
	const { onSuccess, item, menuId, parentId, entities } = props;

	const t = useExtracted();

	const isEditMode = item != null;

	const initialLinkType: LinkType =
		item?.entityId != null ? "internal" : item?.href != null ? "external" : "none";
	const [linkType, setLinkType] = useState<LinkType>(initialLinkType);

	const initialEntityType =
		item?.entityId != null ? (entities.find((e) => e.id === item.entityId)?.type ?? null) : null;
	const [selectedEntityType, setSelectedEntityType] = useState<EntityType | null>(
		initialEntityType,
	);
	const [selectedEntityId, setSelectedEntityId] = useState<string | null>(item?.entityId ?? null);

	const filteredEntities =
		selectedEntityType != null ? entities.filter((e) => e.type === selectedEntityType) : [];

	const serverAction = isEditMode ? updateNavigationItemAction : createNavigationItemAction;

	const [state, formAction, isPending] = useActionState(
		async (prevState: ActionState, formData: FormData) => {
			const result = await serverAction(prevState, formData);
			if (result.status === "success") {
				onSuccess();
			}
			return result;
		},
		createActionStateInitial(),
	);

	const title = isEditMode ? t("Edit item") : t("Add item");

	return (
		<Form action={formAction} state={state}>
			<ModalHeader title={title} />

			<ModalBody className="flex flex-col gap-y-4">
				<FormStatus state={state} />

				{isEditMode && <input name="id" type="hidden" value={item.id} />}
				{!isEditMode && menuId != null && <input name="menuId" type="hidden" value={menuId} />}
				{!isEditMode && parentId != null && (
					<input name="parentId" type="hidden" value={parentId} />
				)}

				<TextField defaultValue={item?.label ?? undefined} isRequired={true} name="label">
					<Label>{t("Label")}</Label>
					<Input />
					<FieldError />
				</TextField>

				<Separator />

				<div className="flex gap-x-2">
					<Button
						intent={linkType === "none" ? "primary" : "outline"}
						onPress={() => {
							setLinkType("none");
						}}
						size="sm"
						type="button"
					>
						{t("Menu trigger")}
					</Button>
					<Button
						intent={linkType === "external" ? "primary" : "outline"}
						onPress={() => {
							setLinkType("external");
						}}
						size="sm"
						type="button"
					>
						{t("External URL")}
					</Button>
					<Button
						intent={linkType === "internal" ? "primary" : "outline"}
						onPress={() => {
							setLinkType("internal");
						}}
						size="sm"
						type="button"
					>
						{t("Internal page")}
					</Button>
				</div>

				{linkType === "none" && (
					<p className="text-muted-fg text-sm">
						{t("This item opens a dropdown menu. Add child items to it after saving.")}
					</p>
				)}

				{linkType === "external" && (
					<Fragment>
						<TextField defaultValue={item?.href ?? undefined} isRequired={true} name="href">
							<Label>{t("URL")}</Label>
							<Input placeholder="https://..." />
							<FieldError />
						</TextField>

						<Checkbox defaultSelected={item?.isExternal ?? false} name="isExternal" value="true">
							{t("Open in new tab")}
						</Checkbox>
					</Fragment>
				)}

				{linkType === "internal" && (
					<Fragment>
						<Select
							onChange={(key) => {
								setSelectedEntityType(key as EntityType);
								setSelectedEntityId(null);
							}}
							value={selectedEntityType}
						>
							<Label>{t("Content type")}</Label>
							<SelectTrigger />
							<SelectContent>
								{allowedEntityTypes.map((type) => (
									<SelectItem key={type} id={type} textValue={entityTypeLabels[type]}>
										{entityTypeLabels[type]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							isDisabled={selectedEntityType == null}
							isRequired={true}
							onChange={(key) => {
								setSelectedEntityId(key as string);
							}}
							value={selectedEntityId}
						>
							<Label>{t("Page")}</Label>
							<SelectTrigger />
							<FieldError />
							<SelectContent>
								{filteredEntities.map((entity) => (
									<SelectItem key={entity.id} id={entity.id} textValue={entity.title}>
										{entity.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Fragment>
				)}

				{linkType !== "external" && <input name="href" type="hidden" value="" />}
				{linkType !== "external" && <input name="isExternal" type="hidden" value="false" />}
				{linkType !== "internal" && <input name="entityId" type="hidden" value="" />}
				{linkType === "internal" && (
					<input name="entityId" type="hidden" value={selectedEntityId ?? ""} />
				)}
			</ModalBody>

			<ModalFooter>
				<ModalClose>{t("Cancel")}</ModalClose>
				<Button isPending={isPending} type="submit">
					{isPending ? (
						<Fragment>
							<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
							<span aria-hidden={true}>{t("Saving...")}</span>
						</Fragment>
					) : (
						t("Save")
					)}
				</Button>
			</ModalFooter>
		</Form>
	);
}

interface NavigationItemFormDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	item?: Pick<schema.NavigationItem, "id" | "label" | "href" | "entityId" | "isExternal"> | null;
	menuId?: string;
	parentId?: string | null;
	entities: Array<EntityOption>;
}

export function NavigationItemFormDialog(
	props: Readonly<NavigationItemFormDialogProps>,
): ReactNode {
	const { isOpen, onOpenChange, item, menuId, parentId, entities } = props;

	const [formKey, setFormKey] = useState(0);

	function handleOpenChange(open: boolean) {
		if (open) {
			setFormKey((k) => k + 1);
		}
		onOpenChange(open);
	}

	return (
		<ModalContent isOpen={isOpen} onOpenChange={handleOpenChange} size="md">
			<NavigationItemForm
				key={`${String(formKey)}-${item?.id ?? "new"}`}
				entities={entities}
				item={item}
				menuId={menuId}
				onSuccess={() => {
					onOpenChange(false);
				}}
				parentId={parentId}
			/>
		</ModalContent>
	);
}
