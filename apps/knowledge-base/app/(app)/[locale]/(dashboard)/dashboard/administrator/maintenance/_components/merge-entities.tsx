"use client";

import { isActionStateError } from "@dariah-eric/next-lib/actions";
import { AsyncSelect } from "@dariah-eric/ui/async-select";
import { Button } from "@dariah-eric/ui/button";
import { Label } from "@dariah-eric/ui/field";
import { Input } from "@dariah-eric/ui/input";
import {
	ModalBody,
	ModalClose,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@dariah-eric/ui/modal";
import { Note } from "@dariah-eric/ui/note";
import { TextField } from "@dariah-eric/ui/text-field";
import { useExtracted } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";

import {
	type EntityOption,
	fetchEntityOptionsPage,
	isSameEntityType,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/entity-option";
import { renderEntityOption } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/entity-option-item";
import { mergeEntitiesAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/merge-entities.action";
import { useRouter } from "@/lib/navigation/navigation";

const CONFIRM_WORD = "MERGE";

function EntitySummary(props: Readonly<{ item: EntityOption }>): ReactNode {
	const { item } = props;
	return (
		<span>
			<span className="font-medium">{item.name}</span>
			{item.description != null ? (
				<span className="text-muted-fg"> · {item.description}</span>
			) : null}
			{item.slug != null ? <span className="text-muted-fg"> · {item.slug}</span> : null}
		</span>
	);
}

export function MergeEntities(): ReactNode {
	const t = useExtracted();
	const router = useRouter();

	const [source, setSource] = useState<EntityOption | null>(null);
	const [target, setTarget] = useState<EntityOption | null>(null);
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);
	const [confirmText, setConfirmText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const sameEntity = source != null && target != null && source.id === target.id;
	const typesMismatch = source != null && target != null && !isSameEntityType(source, target);
	const canMerge = source != null && target != null && !sameEntity && !typesMismatch;

	function reset() {
		setSource(null);
		setTarget(null);
		setConfirmText("");
	}

	function confirmMerge() {
		if (source == null || target == null || confirmText !== CONFIRM_WORD) {
			return;
		}
		setError(null);
		setSuccess(null);
		startTransition(async () => {
			try {
				const state = await mergeEntitiesAction(source.id, target.id);
				if (isActionStateError(state)) {
					const message = Array.isArray(state.message) ? state.message[0] : state.message;
					setError(message ?? t("Could not merge the entities. Please try again."));
					return;
				}
				setSuccess(
					t("Merged “{source}” into “{target}”.", { source: source.name, target: target.name }),
				);
				setIsConfirmOpen(false);
				reset();
				router.refresh();
			} catch {
				setError(t("Could not merge the entities. Please try again."));
			}
		});
	}

	return (
		<div className="flex flex-col gap-y-4 max-inline-xl">
			<div className="flex flex-col gap-y-1">
				<AsyncSelect<EntityOption>
					aria-label={t("Duplicate (source)")}
					fetchPage={fetchEntityOptionsPage}
					initialItems={[]}
					initialTotal={0}
					label={t("Duplicate to remove (source)")}
					loadOnMount={true}
					onSelect={(item) => {
						setSource(item);
						setError(null);
						setSuccess(null);
					}}
					placeholder={t("Search for the duplicate entity…")}
					renderItem={renderEntityOption}
					selectedItem={source}
				/>
				{source?.slug != null ? (
					<p className="text-xs break-all text-muted-fg">{source.slug}</p>
				) : null}
			</div>

			<div className="flex flex-col gap-y-1">
				<AsyncSelect<EntityOption>
					aria-label={t("Canonical (target)")}
					fetchPage={fetchEntityOptionsPage}
					initialItems={[]}
					initialTotal={0}
					label={t("Canonical entity to keep (target)")}
					loadOnMount={true}
					onSelect={(item) => {
						setTarget(item);
						setError(null);
						setSuccess(null);
					}}
					placeholder={t("Search for the canonical entity…")}
					renderItem={renderEntityOption}
					selectedItem={target}
				/>
				{target?.slug != null ? (
					<p className="text-xs break-all text-muted-fg">{target.slug}</p>
				) : null}
			</div>

			<Note intent="warning">
				{t(
					"Merging re-points every relation from the source onto the target, then permanently deletes the source entity (its versions, content, and fields are discarded — only relations are moved). Top-level fields are not merged. This cannot be undone.",
				)}
			</Note>

			{sameEntity ? (
				<Note intent="danger">{t("Source and target must be different entities.")}</Note>
			) : null}

			{typesMismatch ? (
				<Note intent="danger">
					{t("Source and target must be the same type. Pick two entities of the same type.")}
				</Note>
			) : null}

			{error != null ? (
				<Note intent="danger" role="alert">
					{error}
				</Note>
			) : null}

			{success != null ? (
				<Note intent="success" role="status">
					{success}
				</Note>
			) : null}

			<div>
				<Button
					intent="danger"
					isDisabled={!canMerge}
					onPress={() => {
						setConfirmText("");
						setError(null);
						setIsConfirmOpen(true);
					}}
				>
					{t("Merge entities")}
				</Button>
			</div>

			<ModalContent
				isOpen={isConfirmOpen}
				onOpenChange={(open) => {
					if (!open && !isPending) {
						setIsConfirmOpen(false);
					}
				}}
			>
				<ModalHeader
					title={t("Merge entities")}
					description={t(
						"Confirm the source and target below. The source will be permanently deleted.",
					)}
				/>

				<ModalBody className="flex flex-col gap-y-3 text-sm">
					{source != null ? (
						<div>
							<div className="text-xs text-muted-fg uppercase">{t("Delete (source)")}</div>
							<EntitySummary item={source} />
						</div>
					) : null}
					{target != null ? (
						<div>
							<div className="text-xs text-muted-fg uppercase">{t("Keep (target)")}</div>
							<EntitySummary item={target} />
						</div>
					) : null}

					<TextField isDisabled={isPending} onChange={setConfirmText} value={confirmText}>
						<Label>{t("Type {word} to confirm", { word: CONFIRM_WORD })}</Label>
						<Input placeholder={CONFIRM_WORD} />
					</TextField>

					{error != null ? (
						<Note intent="danger" role="alert">
							{error}
						</Note>
					) : null}
				</ModalBody>

				<ModalFooter>
					<ModalClose isDisabled={isPending}>{t("Cancel")}</ModalClose>
					<Button
						intent="danger"
						isDisabled={confirmText !== CONFIRM_WORD}
						isPending={isPending}
						onPress={confirmMerge}
					>
						{t("Merge and delete source")}
					</Button>
				</ModalFooter>
			</ModalContent>
		</div>
	);
}
