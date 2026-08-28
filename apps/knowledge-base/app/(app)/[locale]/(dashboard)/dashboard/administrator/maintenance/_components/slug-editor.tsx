"use client";

import { isActionStateError } from "@dariah-eric/next-lib/actions";
import { AsyncSelect } from "@dariah-eric/ui/async-select";
import { Button } from "@dariah-eric/ui/button";
import { Label } from "@dariah-eric/ui/field";
import { Input } from "@dariah-eric/ui/input";
import { Note } from "@dariah-eric/ui/note";
import { TextField } from "@dariah-eric/ui/text-field";
import { useExtracted } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";

import {
	type EntityOption,
	fetchMaintenanceEntityOptionsPage,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/entity-option";
import { renderEntityOption } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/entity-option-item";
import { updateEntitySlugAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/update-entity-slug.action";
import { useRouter } from "@/lib/navigation/navigation";
import { maxSlugLength } from "@/lib/slug";

export function SlugEditor(): ReactNode {
	const t = useExtracted();
	const router = useRouter();

	const [selected, setSelected] = useState<EntityOption | null>(null);
	const [slug, setSlug] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function onSelect(item: EntityOption) {
		setSelected(item);
		setSlug(item.slug ?? "");
		setError(null);
		setSuccess(null);
	}

	function onSubmit() {
		if (selected == null || slug.trim() === "") {
			return;
		}
		setError(null);
		setSuccess(null);
		startTransition(async () => {
			try {
				const state = await updateEntitySlugAction(selected.id, slug.trim());
				if (isActionStateError(state)) {
					const message = Array.isArray(state.message) ? state.message[0] : state.message;
					setError(message ?? t("Could not update the slug. Please try again."));
					return;
				}
				setSuccess(t("Slug updated."));
				router.refresh();
			} catch {
				setError(t("Could not update the slug. Please try again."));
			}
		});
	}

	return (
		<div className="flex flex-col gap-y-4 max-inline-xl">
			<AsyncSelect<EntityOption>
				aria-label={t("Entity")}
				fetchPage={fetchMaintenanceEntityOptionsPage}
				initialItems={[]}
				initialTotal={0}
				label={t("Entity")}
				loadOnMount={true}
				onSelect={onSelect}
				placeholder={t("Search for an entity…")}
				renderItem={renderEntityOption}
				selectedItem={selected}
			/>

			<TextField
				isDisabled={selected == null || isPending}
				maxLength={maxSlugLength}
				onChange={(value) => {
					setSlug(value);
					setError(null);
					setSuccess(null);
				}}
				value={slug}
			>
				<Label>{t("New slug")}</Label>
				<Input placeholder={t("new-slug")} />
			</TextField>

			{selected?.state === "draft" ? (
				<Note intent="info">
					{t(
						"This entity has never been published, so it has no public URL yet and renaming it breaks nothing. Slugs are normalised (lowercased, spaces and accents removed).",
					)}
				</Note>
			) : (
				<Note intent="warning">
					{t(
						"Changing a slug changes the entity's public URL. Any existing links or bookmarks to the old URL will stop working (404). Slugs are normalised (lowercased, spaces and accents removed).",
					)}
				</Note>
			)}

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
					intent="primary"
					isDisabled={selected == null || slug.trim() === ""}
					isPending={isPending}
					onPress={onSubmit}
				>
					{t("Update slug")}
				</Button>
			</div>
		</div>
	);
}
