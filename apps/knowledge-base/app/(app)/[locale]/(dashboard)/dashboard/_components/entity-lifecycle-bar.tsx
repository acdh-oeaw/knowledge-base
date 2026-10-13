"use client";

import { Badge } from "@dariah-eric/ui/badge";
import { Button } from "@dariah-eric/ui/button";
import { buttonStyles } from "@dariah-eric/ui/button-styles";
import { Link } from "@dariah-eric/ui/link";
import { ModalClose, ModalContent, ModalFooter, ModalHeader } from "@dariah-eric/ui/modal";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";

/**
 * Lifecycle command actions return an ActionState on completion; the bar ignores it. `localeId` is
 * the locale version to act on; omitted, the action acts on the default locale.
 */
type LifecycleAction = (documentId: string, localeId?: string) => Promise<unknown>;

interface EntityLifecycleBarProps {
	documentId: string;
	isPublished: boolean;
	hasDraft: boolean;
	editHref?: string;
	publishAction?: LifecycleAction;
	discardDraftAction?: LifecycleAction;
	/** The locale version being viewed: publish/discard act on it, and edit opens it. */
	locale?: { id: string; code: string };
	/**
	 * The selected locale has no version yet and the default locale's is shown instead. Publish and
	 * discard are hidden — there is nothing in this locale for them to act on.
	 */
	isLocaleFallback?: boolean;
}

export function EntityLifecycleBar(props: Readonly<EntityLifecycleBarProps>): ReactNode {
	const {
		documentId,
		isPublished,
		hasDraft,
		editHref: baseEditHref,
		publishAction: basePublishAction,
		discardDraftAction: baseDiscardDraftAction,
		locale,
		isLocaleFallback = false,
	} = props;

	const editHref =
		baseEditHref != null && locale != null
			? `${baseEditHref}?locale=${encodeURIComponent(locale.code)}`
			: baseEditHref;
	const publishAction = isLocaleFallback ? undefined : basePublishAction;
	const discardDraftAction = isLocaleFallback ? undefined : baseDiscardDraftAction;

	const t = useExtracted();
	const [isPublishing, startPublishTransition] = useTransition();
	const [isDiscarding, startDiscardTransition] = useTransition();
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);

	let badgeIntent: "success" | "info" | "warning";
	let badgeLabel: string;

	if (isLocaleFallback) {
		badgeIntent = "warning";
		badgeLabel = t("Not translated");
	} else if (isPublished && hasDraft) {
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
							await publishAction(documentId, locale?.id);
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
										await discardDraftAction(documentId, locale?.id);
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
