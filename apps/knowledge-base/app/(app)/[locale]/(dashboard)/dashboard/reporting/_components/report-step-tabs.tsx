"use client";

import { Tab, TabList, Tabs } from "@dariah-eric/ui/tabs";
import type { ReactNode } from "react";

import { usePathname } from "@/lib/navigation/navigation";

export interface ReportStep {
	href: string;
	label: string;
}

interface ReportStepTabsProps {
	"aria-label": string;
	steps: ReadonlyArray<ReportStep>;
}

/**
 * Routed tabs for the report editor: each tab is a link to its own route, and the active tab is
 * derived from the current pathname (longest matching prefix, so an index/"Details" tab whose href
 * is a prefix of the others does not steal the selection). Selection survives refresh and is
 * deep-linkable because each tab _is_ a route.
 */
export function ReportStepTabs(props: Readonly<ReportStepTabsProps>): ReactNode {
	const { "aria-label": ariaLabel, steps } = props;

	const pathname = usePathname();

	const active = steps
		.toSorted((a, b) => b.href.length - a.href.length)
		.find((step) => pathname === step.href || pathname.startsWith(`${step.href}/`));
	const selectedKey = active?.href ?? steps[0]?.href;

	return (
		<Tabs aria-label={ariaLabel} className="overflow-x-auto" selectedKey={selectedKey}>
			<TabList>
				{steps.map((step) => (
					<Tab key={step.href} href={step.href} id={step.href}>
						{step.label}
					</Tab>
				))}
			</TabList>
		</Tabs>
	);
}
