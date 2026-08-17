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
	isOpen: boolean;
	isPending?: boolean;
	model: string;
	onAction: () => void;
	onOpenChange: (isOpen: boolean) => void;
}

export function DeleteModal(props: Readonly<DeleteModalProps>): ReactNode {
	const {
		closeOnAction = true,
		errorMessage,
		isOpen,
		isPending = false,
		model,
		onAction,
		onOpenChange,
	} = props;

	const t = useExtracted();

	const title = `Delete ${model}`;
	const description = `Are you sure you want to delete this ${model}? This action cannot be undone.`;

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
