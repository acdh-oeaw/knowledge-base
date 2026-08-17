"use client";

import { Badge } from "@dariah-eric/ui/badge";
import { Button } from "@dariah-eric/ui/button";
import { buttonStyles } from "@dariah-eric/ui/button-styles";
import { Link } from "@dariah-eric/ui/link";
import { ModalClose, ModalContent, ModalFooter, ModalHeader } from "@dariah-eric/ui/modal";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";

/** Lifecycle command actions return an ActionState on completion; the bar ignores it. */
type LifecycleAction = (documentId: string) => Promise<unknown>;

interface EntityLifecycleBarProps {
	documentId: string;
	isPublished: boolean;
	hasDraft: boolean;
	editHref?: string;
	publishAction?: LifecycleAction;
	discardDraftAction?: LifecycleAction;
}

export function EntityLifecycleBar(props: Readonly<EntityLifecycleBarProps>): ReactNode {
	const { documentId, isPublished, hasDraft, editHref, publishAction, discardDraftAction } = props;

	const t = useExtracted();
	const [isPublishing, startPublishTransition] = useTransition();
	const [isDiscarding, startDiscardTransition] = useTransition();
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);

	let badgeIntent: "success" | "info" | "warning";
	let badgeLabel: string;

	if (isPublished && hasDraft) {
		badgeIntent = "info";
		badgeLabel = t("Published with draft changes");
	} else if (isPublished && !hasDraft) {
		badgeIntent = "success";
		badgeLabel = t("Published");
	} else {
		badgeIntent = "warning";
		badgeLabel = t("Draft");
	}

	return (
		<div className="flex items-center gap-x-3">
			<Badge intent={badgeIntent} isCircle={false}>
				{badgeLabel}
			</Badge>

			{editHref != null ? (
				<Link className={buttonStyles({ intent: "secondary", size: "sm" })} href={editHref}>
					<PencilSquareIcon data-slot="icon" />
					{t("Edit")}
				</Link>
			) : null}

			{hasDraft && publishAction != null ? (
				<Button
					intent="primary"
					isPending={isPublishing}
					onPress={() => {
						startPublishTransition(async () => {
							await publishAction(documentId);
						});
					}}
					size="sm"
				>
					{t("Publish saved draft")}
				</Button>
			) : null}

			{hasDraft && isPublished && discardDraftAction != null ? (
				<>
					<Button
						intent="plain"
						isPending={isDiscarding}
						onPress={() => {
							setIsConfirmOpen(true);
						}}
						size="sm"
					>
						{t("Discard draft")}
					</Button>

					<ModalContent isOpen={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
						<ModalHeader
							description={t("Discard unpublished changes? The published version will remain.")}
							title={t("Discard draft")}
						/>
						<ModalFooter>
							<ModalClose>{t("Cancel")}</ModalClose>
							<Button
								intent="warning"
								onPress={() => {
									setIsConfirmOpen(false);
									startDiscardTransition(async () => {
										await discardDraftAction(documentId);
									});
								}}
							>
								{t("Discard")}
							</Button>
						</ModalFooter>
					</ModalContent>
				</>
			) : null}
		</div>
	);
}
