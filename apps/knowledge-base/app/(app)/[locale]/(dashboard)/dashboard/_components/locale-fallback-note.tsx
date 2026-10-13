"use client";

import { buttonStyles } from "@dariah-eric/ui/button-styles";
import { Link } from "@dariah-eric/ui/link";
import { Note } from "@dariah-eric/ui/note";
import { LanguageIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

interface LocaleFallbackNoteProps {
	/**
	 * The entity's edit page, without a locale; the selected locale is appended. `null` when the
	 * viewer cannot edit, which leaves out the button.
	 */
	editHref: string | null;
	locales: ReadonlyArray<{ code: string; name: string }>;
	selectedLocaleCode: string;
}

/**
 * Shown on a details page whose selected locale has no version yet, so the page is displaying the
 * default locale's content instead. Opening the edit page in the selected locale creates that
 * locale's first draft as a copy of the default locale's.
 */
export function LocaleFallbackNote(props: Readonly<LocaleFallbackNoteProps>): ReactNode {
	const { editHref, locales, selectedLocaleCode } = props;

	const t = useExtracted();

	const language =
		locales.find((locale) => locale.code === selectedLocaleCode)?.name ?? selectedLocaleCode;

	return (
		<Note intent="info">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<span>
					{t("There is no {language} version yet, so this page shows the default language.", {
						language,
					})}
				</span>
				{editHref != null ? (
					<Link
						className={buttonStyles({ intent: "secondary", size: "sm" })}
						href={`${editHref}?locale=${encodeURIComponent(selectedLocaleCode)}`}
					>
						<LanguageIcon data-slot="icon" />
						{t("Create {language} version", { language })}
					</Link>
				) : null}
			</div>
		</Note>
	);
}
