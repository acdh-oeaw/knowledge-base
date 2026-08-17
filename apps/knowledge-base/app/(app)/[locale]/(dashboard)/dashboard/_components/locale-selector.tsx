"use client";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { useExtracted } from "next-intl";
import { type ReactNode, useTransition } from "react";
import type { Key } from "react-aria-components";

import { usePathname, useRouter, useSearchParams } from "@/lib/navigation/navigation";

interface LocaleSelectorProps {
  locales: Array<{ code: string; name: string }>;
  selectedLocaleCode: string;
}

/**
 * Switches which locale's version a detail page renders, via the `?locale=` search param — the same
 * URL-driven pattern used by the reporting-statistics filters. Uses each locale's BCP 47-style code
 * (e.g. "en-GB") rather than its db id, so the URL stays readable and stable across environments.
 * Unlike `VersionSelector` (a fixed draft/published toggle), the option count here is data-driven,
 * so it renders as a dropdown rather than a segmented control.
 */
export function LocaleSelector(props: Readonly<LocaleSelectorProps>): ReactNode {
  const { locales, selectedLocaleCode } = props;

  const t = useExtracted();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(key: Key | null): void {
    if (key == null) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("locale", String(key));

    const query = params.toString();

    startTransition(() => {
      router.replace(query === "" ? pathname : `${pathname}?${query}`, { scroll: false });
    });
  }

  if (locales.length < 2) {
    return null;
  }

  return (
    <div className="inline-48">
      <Select
        aria-label={t("Locale")}
        isDisabled={isPending}
        onChange={handleChange}
        value={selectedLocaleCode}
      >
        <SelectTrigger />
        <SelectContent>
          {locales.map((locale) => (
            <SelectItem key={locale.code} id={locale.code}>
              {locale.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
