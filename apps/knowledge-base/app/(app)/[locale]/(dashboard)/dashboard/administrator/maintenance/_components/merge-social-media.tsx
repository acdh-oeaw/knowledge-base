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
import type { AsyncOption, AsyncOptionsFetchPageParams } from "@dariah-eric/ui/use-async-options";
import { useExtracted } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";

import { mergeSocialMediaAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/merge-social-media.action";
import { useRouter } from "@/lib/navigation/navigation";

const CONFIRM_WORD = "MERGE";

/** Social-media options carry a human-readable `type` label; `description` is "<type> · <url>". */
interface SocialMediaOption extends AsyncOption {
	type?: string;
}

async function fetchSocialMediaOptionsPage(
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<SocialMediaOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/social-media/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load social media options.");
	}

	return (await response.json()) as { items: Array<SocialMediaOption>; total: number };
}

function SocialMediaSummary(props: Readonly<{ item: SocialMediaOption }>): ReactNode {
	const { item } = props;
	return (
		<span>
			<span className="font-medium">{item.name}</span>
			{item.description != null ? (
				<span className="break-all text-muted-fg"> · {item.description}</span>
			) : null}
		</span>
	);
}

export function MergeSocialMedia(): ReactNode {
	const t = useExtracted();
	const router = useRouter();

	const [source, setSource] = useState<SocialMediaOption | null>(null);
	const [target, setTarget] = useState<SocialMediaOption | null>(null);
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);
	const [confirmText, setConfirmText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const sameEntry = source != null && target != null && source.id === target.id;
	const canMerge = source != null && target != null && !sameEntry;

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
				const state = await mergeSocialMediaAction(source.id, target.id);
				if (isActionStateError(state)) {
					const message = Array.isArray(state.message) ? state.message[0] : state.message;
					setError(message ?? t("Could not merge the social-media entries. Please try again."));
					return;
				}
				setSuccess(
					t("Merged “{source}” into “{target}”.", { source: source.name, target: target.name }),
				);
				setIsConfirmOpen(false);
				reset();
				router.refresh();
			} catch {
				setError(t("Could not merge the social-media entries. Please try again."));
			}
		});
	}

	return (
		<div className="flex flex-col gap-y-4 max-inline-xl">
			<div className="flex flex-col gap-y-1">
				<AsyncSelect<SocialMediaOption>
					aria-label={t("Duplicate (source)")}
					fetchPage={fetchSocialMediaOptionsPage}
					initialItems={[]}
					initialTotal={0}
					label={t("Duplicate account to remove (source)")}
					loadOnMount={true}
					onSelect={(item) => {
						setSource(item);
						setError(null);
						setSuccess(null);
					}}
					placeholder={t("Search for the duplicate account…")}
					selectedItem={source}
				/>
				{source?.description != null ? (
					<p className="text-xs break-all text-muted-fg">{source.description}</p>
				) : null}
			</div>

			<div className="flex flex-col gap-y-1">
				<AsyncSelect<SocialMediaOption>
					aria-label={t("Canonical (target)")}
					fetchPage={fetchSocialMediaOptionsPage}
					initialItems={[]}
					initialTotal={0}
					label={t("Canonical account to keep (target)")}
					loadOnMount={true}
					onSelect={(item) => {
						setTarget(item);
						setError(null);
						setSuccess(null);
					}}
					placeholder={t("Search for the canonical account…")}
					selectedItem={target}
				/>
				{target?.description != null ? (
					<p className="text-xs break-all text-muted-fg">{target.description}</p>
				) : null}
			</div>

			<Note intent="warning">
				{t(
					"Merging re-points every link from the source onto the target — organisational units, projects, services, and reports — then permanently deletes the source account. The target keeps its own name, URL, and type; nothing from the source is copied over. This also rewrites which account past reports point at. This cannot be undone.",
				)}
			</Note>

			{sameEntry ? (
				<Note intent="danger">{t("Source and target must be different accounts.")}</Note>
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
					{t("Merge accounts")}
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
					title={t("Merge social-media accounts")}
					description={t(
						"Confirm the source and target below. The source will be permanently deleted.",
					)}
				/>

				<ModalBody className="flex flex-col gap-y-3 text-sm">
					{source != null ? (
						<div>
							<div className="text-xs text-muted-fg uppercase">{t("Delete (source)")}</div>
							<SocialMediaSummary item={source} />
						</div>
					) : null}
					{target != null ? (
						<div>
							<div className="text-xs text-muted-fg uppercase">{t("Keep (target)")}</div>
							<SocialMediaSummary item={target} />
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
