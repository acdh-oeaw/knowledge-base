"use client";

import { Tab, type TabProps, Tabs } from "@dariah-eric/ui/tabs";
import type { ReactNode } from "react";
import type { Key } from "react-aria-components";

import { useSearchParams } from "@/lib/navigation/navigation";

interface EntityEditTabsProps {
	/** Tab id selected when no `?tab=` search param is present. */
	defaultTab: string;
	children: ReactNode;
}

/**
 * Tabs for the entity edit screens whose selected tab is reflected in the `?tab=` search param, so
 * it survives a refresh and can be deep-linked.
 *
 * The tab is switched client-side via the native History API rather than a router navigation. This
 * is not just an optimization: switching via a `<Link>` re-renders the target panel, after which
 * its react-aria controls (e.g. a `Select`) are left non-interactive — the trigger focuses on click
 * but the listbox never opens. (App Router has no shallow routing, so a `<Link>` here always
 * triggers a full navigation.) The panels are already rendered and keep their state on the client,
 * so there is nothing to re-run. `history.replaceState` is picked up by `useSearchParams`, which
 * drives the selected tab. The `edit-form-tabs` e2e test guards this.
 */
export function EntityEditTabs(props: Readonly<EntityEditTabsProps>): ReactNode {
	const { defaultTab, children } = props;

	const searchParams = useSearchParams();
	const selectedKey = searchParams.get("tab") ?? defaultTab;

	function handleSelectionChange(key: Key) {
		const params = new URLSearchParams(window.location.search);
		params.set("tab", String(key));
		window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
	}

	return (
		<Tabs onSelectionChange={handleSelectionChange} selectedKey={selectedKey}>
			{children}
		</Tabs>
	);
}

interface EntityEditTabProps extends Omit<TabProps, "href" | "render"> {
	id: string;
}

export function EntityEditTab(props: Readonly<EntityEditTabProps>): ReactNode {
	return <Tab {...props} />;
}
