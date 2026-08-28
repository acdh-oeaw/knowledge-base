"use client";

import type { RichTextHeading } from "@dariah-eric/ui/rich-text";
import cn from "clsx/lite";
import { type ReactNode, useEffect, useState } from "react";

/**
 * The heading a reader is currently under: the last one whose top has passed a line near the top of
 * the viewport. Anything above that line has been read past; anything below has not been reached.
 */
const readingLine = 96;

/**
 * Tracks which entry to mark as current while the reader scrolls.
 *
 * Position rather than `IntersectionObserver`: a section longer than the viewport has no heading on
 * screen at all, and an observer would then report nothing current — precisely in the long sections
 * where knowing your place matters most. Comparing positions always names a heading.
 *
 * `headingIds` is joined into a string so the effect keys off the headings themselves. The array
 * arrives from a server component and its identity is not something this component controls.
 */
function useCurrentHeadingId(headingIds: string): string | null {
	const [currentId, setCurrentId] = useState<string | null>(null);

	useEffect(() => {
		const elements = headingIds
			.split("\n")
			// A slug can begin with a digit ("2024-in-review") or carry a non-latin letter, neither of
			// which is a valid bare `#id` selector — looking the anchor up by id sidesteps escaping it.
			// oxlint-disable-next-line unicorn/prefer-query-selector
			.map((id) => document.getElementById(id))
			.filter((element) => element != null);

		if (elements.length === 0) {
			return;
		}

		function update() {
			let current = elements[0]!;

			for (const element of elements) {
				if (element.getBoundingClientRect().top > readingLine) {
					break;
				}

				current = element;
			}

			// The final sections can be too short to ever push their heading past the reading line, so
			// the last entry would never light up however far the reader scrolls. Once the page cannot
			// scroll any further, whatever is last is what is being read.
			if (Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight) {
				current = elements.at(-1)!;
			}

			setCurrentId(current.id);
		}

		// Scroll fires far more often than the page can paint, and each run measures every heading.
		// Coalescing to one run per frame keeps that off the scrolling thread.
		let frame: number | null = null;

		function schedule() {
			if (frame != null) {
				return;
			}

			frame = requestAnimationFrame(() => {
				frame = null;
				update();
			});
		}

		update();

		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);

		return () => {
			if (frame != null) {
				cancelAnimationFrame(frame);
			}

			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
		};
	}, [headingIds]);

	return currentId;
}

interface DocumentationTableOfContentsProps {
	/** In document order, already narrowed to the levels worth listing. */
	headings: Array<RichTextHeading>;
	/** Names the landmark — there are two other navigations on the page. */
	label: string;
	title: string;
}

export function DocumentationTableOfContents(
	props: Readonly<DocumentationTableOfContentsProps>,
): ReactNode {
	const { headings, label, title } = props;

	const currentId = useCurrentHeadingId(headings.map((heading) => heading.id).join("\n"));

	// A single entry is not an outline of anything — it just repeats the page title back. The column
	// collapses rather than showing it.
	if (headings.length < 2) {
		return null;
	}

	// The rail is the last thing in the source order but the first thing a reader needs, so it is
	// hidden below `xl` rather than stacked: the sidebar already lists the pages, and the article's
	// own headings are a short scroll away.
	return (
		<nav
			aria-label={label}
			className="hidden xl:sticky xl:inset-bs-0 xl:block xl:self-start xl:overflow-y-auto xl:py-12 xl:max-block-screen"
		>
			<p className="mbe-3 text-xs font-medium tracking-wide text-text-weak uppercase">{title}</p>
			<ul className="flex flex-col gap-y-0.5 text-sm">
				{headings.map((heading) => {
					const isCurrent = heading.id === currentId;

					return (
						<li key={heading.id}>
							<a
								aria-current={isCurrent ? "location" : undefined}
								className={cn(
									"block border-s-2 py-1 transition duration-200",
									// Nested headings are indented rather than nested in their own list: the outline
									// is a flat set of destinations, and a `ul` inside an `li` would make a reader
									// using a screen reader hear a list of one entry for every subsection.
									heading.level >= 3 ? "ps-6" : "ps-3",
									isCurrent
										? "border-primary font-medium text-text-strong"
										: "border-transparent text-text-weak hover:border-stroke-weak hover:text-text-strong",
									"outline-2 outline-offset-2 outline-transparent focus-visible:outline-focus-outline",
								)}
								href={`#${heading.id}`}
							>
								{heading.text}
							</a>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
