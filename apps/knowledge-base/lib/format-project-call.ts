import type { ProjectCall } from "@dariah-eric/database/schema";
import { useExtracted } from "next-intl";

/**
 * The German _content_ locale's code (`languageCode-regionCode`, see `lib/data/locales.ts`), as
 * currently seeded — distinct from the interface locale in `lib/i18n/locales.ts`, which stays
 * English-only. If a second German content locale (e.g. `de-DE`) is ever added, this should switch
 * to checking the `de` language prefix instead of the exact code.
 */
const GERMAN_CONTENT_LOCALE_CODE = "de-AT";

/**
 * German overrides for the project-call label, shown only while viewing/editing a project's German
 * content-locale version (see `GERMAN_CONTENT_LOCALE_CODE`) — projects can have per-locale content
 * even though the admin interface itself is English-only. Scoped to this one form-level label
 * rather than a real per-locale translation pipeline, since only this label needs it. Codes not
 * listed here fall back to the English label below.
 */
const germanCallLabels: Partial<Record<ProjectCall["call"], string>> = {
	clariah_at_project_funding: "CLARIAH-AT Projektförderung",
};

/**
 * Human label for a project call/funding programme. A hook (not a plain function taking `t`) so the
 * i18n extractor can find these `t("...")` calls: it only follows literal calls made directly from
 * a file that itself calls `useExtracted()`/`getExtracted()`, not `t` passed in as a parameter.
 *
 * `selectedLocaleCode` is the content locale of the project version currently being viewed/edited
 * (not the interface locale) — pass it so the German overrides only apply to the German version.
 */
export function useProjectCallLabel(
	selectedLocaleCode?: string,
): (call: ProjectCall["call"] | null) => string | null {
	const t = useExtracted();
	const isGermanContentLocale = selectedLocaleCode === GERMAN_CONTENT_LOCALE_CODE;

	return (call) => {
		if (isGermanContentLocale && call != null && call in germanCallLabels) {
			return germanCallLabels[call]!;
		}

		switch (call) {
			case "clariah_at_project_funding": {
				return t("CLARIAH-AT Project Funding");
			}
			case "go_digital_1_0": {
				return t("Go!Digital 1.0");
			}
			case "go_digital_2_0": {
				return t("Go!Digital 2.0");
			}
			case "go_digital_3_0": {
				return t("Go!Digital 3.0");
			}
			case "go_digital_next_generation": {
				return t("Go!Digital Next Generation");
			}
			case null: {
				return null;
			}
			default: {
				return null;
			}
		}
	};
}
