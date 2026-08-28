"use client";

import { isActionStateError } from "@dariah-eric/next-lib/actions";
import { AsyncSelect } from "@dariah-eric/ui/async-select";
import { Button } from "@dariah-eric/ui/button";
import { Description, Label } from "@dariah-eric/ui/field";
import { Input } from "@dariah-eric/ui/input";
import { Link } from "@dariah-eric/ui/link";
import { Note } from "@dariah-eric/ui/note";
import { TextField } from "@dariah-eric/ui/text-field";
import { useExtracted } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";

import {
	type EntityOption,
	fetchEntityOptionsPage,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/entity-option";
import { renderEntityOption } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/entity-option-item";
import { duplicateEntityAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_lib/duplicate-entity.action";
import { useRouter } from "@/lib/navigation/navigation";

const draftsHref = "/dashboard/administrator/drafts";

export function DuplicateEntity(): ReactNode {
	const t = useExtracted();
	const router = useRouter();

	const [source, setSource] = useState<EntityOption | null>(null);
	const [slug, setSlug] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function duplicate() {
		if (source == null) {
			return;
		}

		setError(null);
		setSuccess(null);

		startTransition(async () => {
			try {
				const state = await duplicateEntityAction(source.id, slug);
				if (isActionStateError(state)) {
					const message = Array.isArray(state.message) ? state.message[0] : state.message;
					setError(message ?? t("Could not duplicate the entity. Please try again."));
					return;
				}
				setSuccess(t("Created a draft copy of “{source}”.", { source: source.name }));
				setSource(null);
				setSlug("");
				router.refresh();
			} catch {
				setError(t("Could not duplicate the entity. Please try again."));
			}
		});
	}

	return (
		<div className="flex flex-col gap-y-4 max-inline-xl">
			<div className="flex flex-col gap-y-1">
				<AsyncSelect<EntityOption>
					aria-label={t("Entity to duplicate")}
					fetchPage={fetchEntityOptionsPage}
					initialItems={[]}
					initialTotal={0}
					label={t("Entity to duplicate")}
					loadOnMount={true}
					onSelect={(item) => {
						setSource(item);
						// Prefill the provisional slug the server would derive anyway, so the common case is
						// one click and the split case is one edit.
						setSlug(item.slug != null ? `${item.slug}-copy` : "");
						setError(null);
						setSuccess(null);
					}}
					placeholder={t("Search for the entity to duplicate…")}
					renderItem={renderEntityOption}
					selectedItem={source}
				/>
				{source?.slug != null ? (
					<p className="text-xs break-all text-muted-fg">{source.slug}</p>
				) : null}
			</div>

			<TextField isDisabled={isPending || source == null} onChange={setSlug} value={slug}>
				<Label>{t("Slug for the copy")}</Label>
				<Input placeholder={t("my-new-entity")} />
				<Description>
					{t(
						"Set the copy's final slug now — it forms the public URL and cannot be changed from the entity form later.",
					)}
				</Description>
			</TextField>

			<Note intent="info">
				{t(
					"The copy is created as an unpublished draft with the same title, content blocks, social media, related entities, and relations as the original — including their start and end dates. Reporting data is never copied: the copy appears in no country or working-group report. Retitle the draft and adjust its relations before publishing it.",
				)}
			</Note>

			{error != null ? (
				<Note intent="danger" role="alert">
					{error}
				</Note>
			) : null}

			{success != null ? (
				<Note intent="success" role="status">
					{success}{" "}
					<Link className="underline" href={draftsHref}>
						{t("Open drafts to rename and publish it.")}
					</Link>
				</Note>
			) : null}

			<div>
				<Button isDisabled={source == null} isPending={isPending} onPress={duplicate}>
					{t("Duplicate entity")}
				</Button>
			</div>
		</div>
	);
}
