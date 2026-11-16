"use client";

import { AsyncSelect } from "@dariah-eric/ui/async-select";
import { Button } from "@dariah-eric/ui/button";
import { ModalBody, ModalContent, ModalFooter, ModalHeader } from "@dariah-eric/ui/modal";
import { useExtracted } from "next-intl";
import { type ReactNode, useState } from "react";

import {
	type EntityOption,
	fetchPersonOptionsPage,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/entity-option";
import { renderEntityOption } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/entity-option-item";

interface PersonPickerDialogProps {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** Receives the person's document id and their current name. */
	onSelect: (entityId: string, name: string) => void;
}

/**
 * Picks a person to credit a quote to.
 *
 * Published persons only, from the same endpoint the relation pickers use: a byline is shown on the
 * website, and should not name somebody whose entry is still a draft. What is stored is the
 * document id, so the website can show the person's current name and portrait and link to their
 * page.
 */
export function PersonPickerDialog({
	isOpen,
	onOpenChange,
	onSelect,
}: Readonly<PersonPickerDialogProps>): ReactNode {
	const t = useExtracted();

	const [selected, setSelected] = useState<EntityOption | null>(null);

	function close() {
		onOpenChange(false);
		setSelected(null);
	}

	return (
		<ModalContent isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
			<ModalHeader
				description={t("The byline shows the person's current name and portrait.")}
				title={t("Add a person")}
			/>
			<ModalBody>
				<AsyncSelect<EntityOption>
					aria-label={t("Person")}
					fetchPage={fetchPersonOptionsPage}
					initialItems={[]}
					initialTotal={0}
					label={t("Person")}
					loadOnMount={true}
					onSelect={setSelected}
					placeholder={t("Search for a person…")}
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
					{t("Add")}
				</Button>
			</ModalFooter>
		</ModalContent>
	);
}
