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

import { mergeServicesAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/merge-services.action";
import { useRouter } from "@/lib/navigation/navigation";

const CONFIRM_WORD = "MERGE";

/** `description` is "<type> · <status>", plus "SSHOC <id>" for marketplace-ingested services. */
interface ServiceOption extends AsyncOption {
	status?: string;
	sshocMarketplaceId?: string | null;
}

async function fetchServiceOptionsPage(
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<ServiceOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/services/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load service options.");
	}

	return (await response.json()) as { items: Array<ServiceOption>; total: number };
}

function ServiceSummary(props: Readonly<{ item: ServiceOption }>): ReactNode {
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

export function MergeServices(): ReactNode {
	const t = useExtracted();
	const router = useRouter();

	const [source, setSource] = useState<ServiceOption | null>(null);
	const [target, setTarget] = useState<ServiceOption | null>(null);
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);
	const [confirmText, setConfirmText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const sameService = source != null && target != null && source.id === target.id;
	const canMerge = source != null && target != null && !sameService;

	/**
	 * A marketplace service the SSHOC ingest still returns is re-created after the merge, because the
	 * ingest matches on the marketplace id.
	 *
	 * "Needs review" is the only status that evidences the marketplace has dropped it: the ingest
	 * sets it precisely when a service stops being returned, but _only_ for services currently "live"
	 * (the `servicesToMarkNeedsReview` pass in `@dariah-eric/sshoc-services`). A "to be discontinued"
	 * or "discontinued" service therefore keeps that status whether or not it is still listed, so it
	 * says nothing either way and must be warned about too — the check is "not needs review", not
	 * "live".
	 *
	 * A warning rather than a hard block: an admin may knowingly merge and fix the source in the
	 * marketplace afterwards.
	 */
	const willBeReingested = source?.sshocMarketplaceId != null && source.status !== "needs_review";

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
				const state = await mergeServicesAction(source.id, target.id);
				if (isActionStateError(state)) {
					const message = Array.isArray(state.message) ? state.message[0] : state.message;
					setError(message ?? t("Could not merge the services. Please try again."));
					return;
				}
				setSuccess(
					t("Merged “{source}” into “{target}”.", { source: source.name, target: target.name }),
				);
				setIsConfirmOpen(false);
				reset();
				router.refresh();
			} catch {
				setError(t("Could not merge the services. Please try again."));
			}
		});
	}

	return (
		<div className="flex flex-col gap-y-4 max-inline-xl">
			<div className="flex flex-col gap-y-1">
				<AsyncSelect<ServiceOption>
					aria-label={t("Duplicate (source)")}
					fetchPage={fetchServiceOptionsPage}
					initialItems={[]}
					initialTotal={0}
					label={t("Duplicate service to remove (source)")}
					loadOnMount={true}
					onSelect={(item) => {
						setSource(item);
						setError(null);
						setSuccess(null);
					}}
					placeholder={t("Search for the duplicate service…")}
					selectedItem={source}
				/>
				{source?.description != null ? (
					<p className="text-xs break-all text-muted-fg">{source.description}</p>
				) : null}
			</div>

			<div className="flex flex-col gap-y-1">
				<AsyncSelect<ServiceOption>
					aria-label={t("Canonical (target)")}
					fetchPage={fetchServiceOptionsPage}
					initialItems={[]}
					initialTotal={0}
					label={t("Canonical service to keep (target)")}
					loadOnMount={true}
					onSelect={(item) => {
						setTarget(item);
						setError(null);
						setSuccess(null);
					}}
					placeholder={t("Search for the canonical service…")}
					selectedItem={target}
				/>
				{target?.description != null ? (
					<p className="text-xs break-all text-muted-fg">{target.description}</p>
				) : null}
			</div>

			<Note intent="warning">
				{t(
					"Merging re-points every reference from the source onto the target — consortium roles, social-media links, and the country reports that list the service or report KPIs against it — then permanently deletes the source service. The target keeps its own name, type, status, and marketplace id; nothing from the source is copied over. This also rewrites which service past reports point at. This cannot be undone.",
				)}
			</Note>

			{sameService ? (
				<Note intent="danger">{t("Source and target must be different services.")}</Note>
			) : null}

			{willBeReingested ? (
				<Note intent="warning">
					{t(
						"The source came from the SSHOC marketplace and may still be listed there. If it is, the next ingest will re-create it, because it matches on the marketplace id. Only the “Needs review” status shows the marketplace has dropped a service — every other status leaves it an open question. Merge now only if you will retire the source in the marketplace too.",
					)}
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
					{t("Merge services")}
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
					title={t("Merge duplicate services")}
					description={t(
						"Confirm the source and target below. The source will be permanently deleted.",
					)}
				/>

				<ModalBody className="flex flex-col gap-y-3 text-sm">
					{source != null ? (
						<div>
							<div className="text-xs text-muted-fg uppercase">{t("Delete (source)")}</div>
							<ServiceSummary item={source} />
						</div>
					) : null}
					{target != null ? (
						<div>
							<div className="text-xs text-muted-fg uppercase">{t("Keep (target)")}</div>
							<ServiceSummary item={target} />
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
