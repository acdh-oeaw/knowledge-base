"use client";

import { Description, FieldError, Label } from "@dariah-eric/ui/field";
import { Input } from "@dariah-eric/ui/input";
import { TextField } from "@dariah-eric/ui/text-field";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import { maxSlugLength } from "@/lib/slug";

interface EntitySlugFieldProps {
	/** The document's current slug. Omit when creating — there is none yet. */
	slug?: string;
	/**
	 * Whether the document is already published. A published slug is a live URL whose rename needs
	 * redirects and search-index cleanup, so the field goes read-only and points at the maintenance
	 * slug editor. The server enforces this too — the field being read-only is a courtesy, not the
	 * check.
	 */
	isPublished?: boolean;
}

/**
 * The slug field shared by every entity form: the last part of the entity's public URL.
 *
 * Three states, because a slug means something different at each point of a document's life:
 * creating (empty, derived from the title unless the user chooses one), draft (freely renameable —
 * nothing links to it yet), published (frozen outside the maintenance tab).
 */
export function EntitySlugField(props: Readonly<EntitySlugFieldProps>): ReactNode {
	const { slug, isPublished = false } = props;

	const t = useExtracted();

	if (isPublished) {
		return (
			// A disabled field submits no value, which is exactly right: the action then sees no
			// requested slug and leaves the published one alone.
			<TextField isDisabled={true} name="slug" value={slug}>
				<Label>{t("Slug")}</Label>
				<Input />
				<Description>
					{t(
						"This entity is published, so its web address is public. Changing it can break existing links, so it is done by an administrator on the Maintenance page.",
					)}
				</Description>
			</TextField>
		);
	}

	return (
		// A coarse cap, not the rule: `maxLength` counts UTF-16 code units of what is typed, while the
		// limit applies to the bytes of the slug that gets stored — and slugifying moves in both
		// directions, dropping punctuation but expanding transliterations ("ä" → "ae"). It keeps a
		// pasted article title from silently overrunning the field; `EntitySlugInputSchema` is what
		// actually decides, by measuring the slugified value.
		<TextField defaultValue={slug} maxLength={maxSlugLength} name="slug">
			<Label>{t("Slug")}</Label>
			<Input placeholder={slug == null ? t("Generated from the title") : undefined} />
			<Description>
				{slug == null
					? t(
							"Used to build this entity's public web address once it is published — a short name like history-of-dariah. Leave empty to generate it from the title.",
						)
					: t(
							"Used to build this entity's public web address once it is published — a short name like history-of-dariah. It isn't public yet, so you can still change it freely.",
						)}
			</Description>
			<FieldError />
		</TextField>
	);
}
