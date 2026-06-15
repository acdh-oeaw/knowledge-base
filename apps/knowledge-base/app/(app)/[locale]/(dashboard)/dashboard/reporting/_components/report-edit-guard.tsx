"use client";

import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useRef } from "react";
import { RouterProvider as AriaRouterProvider } from "react-aria-components";

import { useRouter } from "@/lib/navigation/navigation";

interface ReportEditGuardProps {
	children: ReactNode;
}

/**
 * Warns before discarding unsaved edits when leaving a report editor screen. Each screen is its own
 * route, so switching tabs (or following any link) is a navigation that would silently drop
 * in-progress input.
 *
 * Interception happens at the nearest `AriaRouterProvider` `navigate`: react-aria drives tab-link
 * navigation through it (and `preventDefault`s the native click, so next/link's own `onNavigate`
 * never runs), so wrapping `navigate` here is the one reliable chokepoint. Scoping the provider to
 * the editor keeps the guard from affecting the rest of the app.
 *
 * Dirtiness is tracked generically from capture-phase `input`/`submit` events bubbling out of the
 * subtree, so every form (including the contenteditable rich-text answers) is covered without each
 * one having to opt in. `beforeunload` covers hard exits (reload / closing the tab), which
 * `navigate` does not see.
 */
export function ReportEditGuard(props: Readonly<ReportEditGuardProps>): ReactNode {
	const { children } = props;

	const t = useExtracted();
	const router = useRouter();

	const isDirtyRef = useRef(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = containerRef.current;
		if (el == null) {
			return;
		}

		function markDirty(): void {
			isDirtyRef.current = true;
		}

		function markClean(): void {
			isDirtyRef.current = false;
		}

		// Capture phase so we observe events from any descendant form, including contenteditable editors.
		el.addEventListener("input", markDirty, true);
		el.addEventListener("submit", markClean, true);

		return () => {
			el.removeEventListener("input", markDirty, true);
			el.removeEventListener("submit", markClean, true);
		};
	}, []);

	useEffect(() => {
		function handleBeforeUnload(event: BeforeUnloadEvent): void {
			if (isDirtyRef.current) {
				event.preventDefault();
			}
		}

		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, []);

	const navigate = (...args: Parameters<typeof router.push>): void => {
		if (
			isDirtyRef.current &&
			!window.confirm(t("You have unsaved changes. Leave this screen without saving?"))
		) {
			return;
		}

		isDirtyRef.current = false;
		router.push(...args);
	};

	return (
		<AriaRouterProvider navigate={navigate}>
			<div ref={containerRef} className="contents">
				{children}
			</div>
		</AriaRouterProvider>
	);
}
