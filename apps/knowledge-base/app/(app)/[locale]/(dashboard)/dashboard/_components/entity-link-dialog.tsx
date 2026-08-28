"use client";

import { AsyncSelect } from "@dariah-eric/ui/async-select";
import { Button } from "@dariah-eric/ui/button";
import { ModalBody, ModalContent, ModalFooter, ModalHeader } from "@dariah-eric/ui/modal";
import { useExtracted } from "next-intl";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";

import {
	type EntityOption,
	fetchEntityOptionsByIds,
	fetchEntityOptionsPage,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/entity-option";
import { renderEntityOption } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/entity-option-item";

interface EntityLinkDialogProps {
	/** Receives the entity's document id and its label, to use as the link text. */
	onSelect: (entityId: string, label: string) => void;
	/**
	 * The entity the link already points at, when the dialog was opened to change one. Only its id is
	 * stored, so the dialog resolves it to a name of its own accord — opening on a blank picker would
	 * make "change" indistinguishable from "start again", and hide which page is about to be
	 * replaced.
	 */
	selectedEntityId?: string | null;
	/**
	 * Renders its own trigger when given one. Callers that open the dialog from a menu pass
	 * `isOpen`/`onOpenChange` instead and omit this: a trigger nested in a menu is unmounted by the
	 * menu closing, before the dialog it opens ever appears.
	 */
	trigger?: ComponentType<{ open: () => void }>;
	isOpen?: boolean;
	onOpenChange?: (isOpen: boolean) => void;
}

/**
 * Picks an entity for a rich-text link to point at.
 *
 * Backed by `/api/relations/entities`, the same published-only endpoint the relation pickers use —
 * "what may this link to" is the same question as "what may this relate to", and an editor should
 * not be able to link readers at an unpublished draft.
 *
 * What is stored is the document id, never the slug or a path: the API resolves it to the entity's
 * current url at read time, so renaming a slug moves every link that points at it.
 */
export function EntityLinkDialog({
	onSelect,
	selectedEntityId = null,
	trigger: Trigger,
	isOpen: controlledIsOpen,
	onOpenChange,
}: Readonly<EntityLinkDialogProps>): ReactNode {
	const t = useExtracted();

	const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
	const [selected, setSelected] = useState<EntityOption | null>(null);

	const isOpen = controlledIsOpen ?? uncontrolledIsOpen;

	/**
	 * Resolve the entity the link points at, once the dialog is actually open. Deferred until then
	 * because this component stays mounted for the life of the editor — the dialog it renders is
	 * opened from a menu, which cannot host it — so resolving on mount would look every link up
	 * whether or not anyone ever opens the picker.
	 *
	 * An id that no longer resolves leaves the picker empty, which is the honest rendering: the
	 * dialog cannot name a page that is gone, and the author is choosing a replacement anyway.
	 */
	useEffect(() => {
		if (!isOpen || selectedEntityId == null) {
			return;
		}

		const controller = new AbortController();
		const entityId = selectedEntityId;

		async function resolveSelected() {
			try {
				const items = await fetchEntityOptionsByIds([entityId], controller.signal);
				const entity = items.at(0);
				if (entity != null) {
					setSelected(entity);
				}
			} catch {
				// Leaves the picker empty, same as an id that resolved to nothing.
			}
		}

		void resolveSelected();

		return () => {
			controller.abort();
		};
	}, [isOpen, selectedEntityId]);

	function setIsOpen(next: boolean) {
		setUncontrolledIsOpen(next);
		onOpenChange?.(next);
	}

	function close() {
		setIsOpen(false);
		setSelected(null);
	}

	return (
		<>
			{Trigger != null ? (
				<Trigger
					open={() => {
						setIsOpen(true);
					}}
				/>
			) : null}
			<ModalContent isOpen={isOpen} onOpenChange={setIsOpen} size="lg">
				<ModalHeader
					description={t("The link keeps working if the page is later renamed.")}
					title={t("Link to a page")}
				/>
				<ModalBody>
					<AsyncSelect<EntityOption>
						aria-label={t("Page to link to")}
						fetchPage={fetchEntityOptionsPage}
						initialItems={[]}
						initialTotal={0}
						label={t("Page to link to")}
						loadOnMount={true}
						onSelect={setSelected}
						placeholder={t("Search for a page…")}
						renderItem={renderEntityOption}
						selectedItem={selected}
					/>
				</ModalBody>
				<ModalFooter>
					<Button intent="outline" onPress={close} type="button">
						{t("Cancel")}
					</Button>
					<Button
						intent="primary"
						isDisabled={selected == null}
						onPress={() => {
							if (selected == null) {
								return;
							}
							onSelect(selected.id, selected.name);
							close();
						}}
						type="button"
					>
						{t("Link")}
					</Button>
				</ModalFooter>
			</ModalContent>
		</>
	);
}
