"use client";

import cn from "clsx/lite";
import { type ReactNode, useId, useState } from "react";

import type { PublishedDocumentationPage } from "@/app/(app)/[locale]/(default)/documentation/_lib/documentation-pages";
import { NavLink } from "@/components/nav-link";

/**
 * The current page is marked with a rule along the inline start, the convention in documentation
 * sidebars — it reads as a position in a list, which colour alone does not, and it survives a
 * reader who cannot tell the two text colours apart. `aria-current` carries the same fact to
 * assistive technology, and `NavLink` derives it from the pathname.
 */
const navLinkStyles = cn(
	"block border-s-2 border-transparent py-1 ps-3 text-sm text-text-weak transition duration-200",
	"hover:border-stroke-weak hover:text-text-strong",
	"aria-[current]:border-primary aria-[current]:font-medium aria-[current]:text-text-strong",
	"outline-2 outline-offset-2 outline-transparent focus-visible:outline-focus-outline",
);

interface DocumentationNavigationProps {
	/** Names the landmark, since the page already carries the site's main navigation. */
	label: string;
	overviewLabel: string;
	/** Alphabetical, and without the overview page — that is the fixed first entry. */
	pages: Array<PublishedDocumentationPage>;
	/** Labels the control that unfolds the list on narrow screens. */
	toggleLabel: string;
}

export function DocumentationNavigation(props: Readonly<DocumentationNavigationProps>): ReactNode {
	const { label, overviewLabel, pages, toggleLabel } = props;

	// Below `lg` the navigation sits above the article instead of beside it, where a full page list
	// would push the content the reader came for off the screen, so it starts collapsed. From `lg`
	// up the list is always shown and only the toggle is hidden — one list, one landmark, the same
	// links at every width.
	const [isExpanded, setIsExpanded] = useState(false);
	const listId = useId();

	return (
		<nav
			aria-label={label}
			className="border-be border-stroke-weak py-4 lg:sticky lg:inset-bs-0 lg:self-start lg:overflow-y-auto lg:border-e lg:border-be-0 lg:py-12 lg:pe-6 lg:max-block-screen"
		>
			<button
				aria-controls={listId}
				aria-expanded={isExpanded}
				className="flex items-center gap-x-2 rounded-sm p-1 text-sm font-medium text-text-strong outline-2 outline-offset-2 outline-transparent focus-visible:outline-focus-outline lg:hidden"
				onClick={() => {
					setIsExpanded((isExpanded) => !isExpanded);
				}}
				type="button"
			>
				<svg
					aria-hidden={true}
					className={cn(
						"shrink-0 transition-transform block-4 inline-4",
						isExpanded && "rotate-90",
					)}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
				</svg>
				{toggleLabel}
			</button>

			<ul
				className={cn("flex-col gap-y-0.5 pbs-3 lg:flex lg:pbs-0", isExpanded ? "flex" : "hidden")}
				id={listId}
			>
				<li>
					<NavLink className={navLinkStyles} href="/documentation">
						{overviewLabel}
					</NavLink>
				</li>
				{pages.map((page) => (
					<li key={page.id}>
						<NavLink className={navLinkStyles} href={`/documentation/${page.slug}`}>
							{page.title}
						</NavLink>
					</li>
				))}
			</ul>
		</nav>
	);
}
