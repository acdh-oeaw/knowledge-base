"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";

/**
 * Footer of a block edit panel. Its buttons act on the block as a whole rather than on the setting
 * directly above them, so they sit below a rule which spans the full panel — the panel's own `p-4`
 * is reversed out and then reapplied.
 */
export const blockPanelFooterClassName =
	"-ms-4 -me-4 mbs-1 flex items-center gap-x-2 border-bs border-border px-4 pbs-3";

/**
 * Marks a container node's DOM as draggable, and hands back the ref to put on its
 * `NodeViewWrapper`.
 *
 * ProseMirror sets `draggable` itself only for nodes with no content hole (see `NodeViewDesc`), so
 * a container — whose body is editable prose — never gets it. Without the attribute the browser
 * fires no `dragstart`, tiptap's `data-drag-handle` handling never runs, and the block cannot be
 * moved at all. The same reason `BlockNodeSurface` sets it for the atoms it wraps.
 *
 * Cleared while the node is not draggable — a read-only editor, or a settings panel the author is
 * filling in — so a drag can never start from a form.
 */
export function useContainerDraggable(isDraggable: boolean): RefObject<HTMLDivElement | null> {
	const wrapperRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		const nodeViewContainer = wrapperRef.current?.parentElement;
		if (nodeViewContainer == null) {
			return;
		}

		if (isDraggable) {
			nodeViewContainer.setAttribute("draggable", "true");
		} else {
			nodeViewContainer.removeAttribute("draggable");
		}
	}, [isDraggable]);

	return wrapperRef;
}
