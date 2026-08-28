"use client";

import { Note } from "@dariah-eric/ui/note";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";

import {
	type EntityOption,
	fetchEntityOptionsByIds,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/entity-option";

interface LinkTargetSummaryProps {
	target: { kind: "asset"; assetKey: string } | { kind: "entity"; entityId: string };
}

/**
 * Names what a rich-text link points at, for the editor's link popover.
 *
 * A link that points at something we own stores only the reference, so the editor can say which
 * kind of thing it is but not which one. This resolves that: a document key against
 * `/api/assets/by-key`, an entity id against `/api/relations/entities`.
 *
 * Both go to the server rather than to whatever the form already holds. The editor's
 * `initialAssets` is the media library's first page for the image prefix — the document a link
 * points at is usually not in it, and a lookup that misses is indistinguishable from a document
 * that is gone.
 *
 * A reference that really resolves to nothing is reported as such rather than passed over: a
 * deleted document, an unpublished or page-less entity all render as plain text on the website, and
 * an editor proof-reading a page needs to see that while they can still fix it.
 */
export function LinkTargetSummary({ target }: Readonly<LinkTargetSummaryProps>): ReactNode {
	return target.kind === "asset" ? (
		<AssetLinkTargetSummary assetKey={target.assetKey} />
	) : (
		<EntityLinkTargetSummary entityId={target.entityId} />
	);
}

function AssetLinkTargetSummary({ assetKey }: Readonly<{ assetKey: string }>): ReactNode {
	const t = useExtracted();

	const [label, setLabel] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(true);

	useEffect(() => {
		const controller = new AbortController();

		async function resolveAsset() {
			try {
				const response = await fetch(`/api/assets/by-key?key=${encodeURIComponent(assetKey)}`, {
					signal: controller.signal,
				});

				if (!response.ok) {
					setLabel(null);
					setIsPending(false);
					return;
				}

				const data = (await response.json()) as { asset: { label?: string | null } };
				setLabel(data.asset.label ?? assetKey);
				setIsPending(false);
			} catch {
				// An aborted request is the popover closing, and the state it would set is gone with it.
				if (!controller.signal.aborted) {
					setLabel(null);
					setIsPending(false);
				}
			}
		}

		void resolveAsset();

		return () => {
			controller.abort();
		};
	}, [assetKey]);

	if (isPending) {
		return <Note intent="info">{t("This link points to a document.")}</Note>;
	}

	return label != null ? (
		<Note intent="info">{t("Links to the document {label}.", { label })}</Note>
	) : (
		<Note intent="warning">{t("This document is no longer available.")}</Note>
	);
}

/** Split out because only the entity branch needs to load anything. */
function EntityLinkTargetSummary({ entityId }: Readonly<{ entityId: string }>): ReactNode {
	const t = useExtracted();

	const [entity, setEntity] = useState<EntityOption | null>(null);
	const [isPending, setIsPending] = useState(true);

	useEffect(() => {
		const controller = new AbortController();

		setIsPending(true);

		async function resolveEntity() {
			try {
				const items = await fetchEntityOptionsByIds([entityId], controller.signal);
				setEntity(items.at(0) ?? null);
				setIsPending(false);
			} catch {
				// An aborted request is the popover closing, and the state it would set is gone with it.
				if (!controller.signal.aborted) {
					setEntity(null);
					setIsPending(false);
				}
			}
		}

		void resolveEntity();

		return () => {
			controller.abort();
		};
	}, [entityId]);

	if (isPending) {
		return <Note intent="info">{t("This link points to another page.")}</Note>;
	}

	return entity != null ? (
		<Note intent="info">{t("Links to the page {label}.", { label: entity.name })}</Note>
	) : (
		<Note intent="warning">{t("This page is no longer published.")}</Note>
	);
}
