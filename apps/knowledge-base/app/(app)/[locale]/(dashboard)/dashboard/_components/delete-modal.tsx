"use client";

import { Button } from "@dariah-eric/ui/button";
import { ModalClose, ModalContent, ModalFooter, ModalHeader } from "@dariah-eric/ui/modal";
import { AlertTriangleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

interface DeleteModalProps {
	/**
	 * When true (default), the dialog auto-closes when the Delete button is pressed. Set to false to
	 * keep the dialog open while the action runs — useful when the caller wants to render an inline
	 * error on failure.
	 */
	closeOnAction?: boolean;
	errorMessage?: string | null;
	isConfirmDisabled?: boolean;
	isOpen: boolean;
	isPending?: boolean;
	/** The languages the item exists in; named in the description when there is more than one. */
	languages?: ReadonlyArray<string>;
	model: string;
	onAction: () => void;
	onOpenChange: (isOpen: boolean) => void;
}

const languageList = new Intl.ListFormat("en", { type: "conjunction" });

export function DeleteModal(props: Readonly<DeleteModalProps>): ReactNode {
	const {
		closeOnAction = true,
		errorMessage,
		isConfirmDisabled = false,
		isOpen,
		isPending = false,
		languages = [],
		model,
		onAction,
		onOpenChange,
	} = props;

	const t = useExtracted();

	const title = `Delete ${model}`;
	const description =
		languages.length > 1
			? `Are you sure you want to delete this ${model}? It will be deleted in all languages: ${languageList.format(languages)}. This action cannot be undone.`
			: `Are you sure you want to delete this ${model}? This action cannot be undone.`;

	return (
		<ModalContent isOpen={isOpen} onOpenChange={onOpenChange}>
			<ModalHeader description={description} title={title} />
			{errorMessage != null ? (
				<div className="px-6 pbe-2">
					<p
						className="flex items-center gap-x-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
						role="alert"
					>
						<AlertTriangleIcon aria-hidden={true} className="block-4 inline-4" />
						{errorMessage}
					</p>
				</div>
			) : null}
			<ModalFooter>
				<ModalClose isDisabled={isPending}>{t("Cancel")}</ModalClose>
				<Button
					intent="danger"
					isDisabled={isConfirmDisabled}
					isPending={isPending}
					onPress={() => {
						onAction();
						if (closeOnAction) {
							onOpenChange(false);
						}
					}}
				>
					{t("Delete")}
				</Button>
			</ModalFooter>
		</ModalContent>
	);
}
