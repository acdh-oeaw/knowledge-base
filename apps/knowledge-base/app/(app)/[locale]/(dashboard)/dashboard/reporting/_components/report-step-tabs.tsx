"use client";

import { Tab, TabList, Tabs } from "@dariah-eric/ui/tabs";
import type { ReactNode } from "react";

import { usePathname } from "@/lib/navigation/navigation";

export interface ReportStep {
	href: string;
	label: string;
	/**
	 * Route to match the current pathname against. Defaults to {@link href}, and only needs setting
	 * when `href` carries search params (which never take part in the match).
	 */
	path?: string;
}

interface ReportStepTabsProps {
	"aria-label": string;
	/**
	 * Route of a tab switch that is still in flight, if the caller drives its navigation through a
	 * transition. Selecting it ahead of the commit is what makes a slow tab feel answered.
	 */
	pendingPath?: string | null;
	steps: ReadonlyArray<ReportStep>;
}

function stepPath(step: ReportStep): string {
	return step.path ?? step.href;
}

/**
 * Routed tabs for the report editor: each tab is a link to its own route, and the active tab is
 * derived from the current pathname (longest matching prefix, so an index/"Details" tab whose href
 * is a prefix of the others does not steal the selection). Selection survives refresh and is
 * deep-linkable because each tab _is_ a route.
 *
 * A caller that navigates inside a transition can pass {@link ReportStepTabsProps.pendingPath} to
 * have the destination selected while the route is still loading.
 */
export function ReportStepTabs(props: Readonly<ReportStepTabsProps>): ReactNode {
	const { "aria-label": ariaLabel, pendingPath, steps } = props;

	const pathname = usePathname();

	const currentPath = pendingPath ?? pathname;
	const active = steps
		.toSorted((a, b) => stepPath(b).length - stepPath(a).length)
		.find((step) => currentPath === stepPath(step) || currentPath.startsWith(`${stepPath(step)}/`));
	const selectedStep = active ?? steps[0];
	const selectedKey = selectedStep != null ? stepPath(selectedStep) : undefined;

	return (
		<Tabs aria-label={ariaLabel} className="-mx-3 overflow-x-auto px-3" selectedKey={selectedKey}>
			<TabList>
				{steps.map((step) => (
					<Tab key={stepPath(step)} href={step.href} id={stepPath(step)}>
						{step.label}
					</Tab>
				))}
			</TabList>
		</Tabs>
	);
}
