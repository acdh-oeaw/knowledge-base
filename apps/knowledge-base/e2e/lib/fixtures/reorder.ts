import type { Locator, Page } from "@playwright/test";

/**
 * Move a selected row one position down within an orderable `AsyncListSelect` grid via pointer
 * drag-and-drop. React Aria's keyboard drag-and-drop is hard to drive deterministically here (the
 * grid's roving focus + i18n-broken drop-target labels), so we drag the row's handle
 * (`slot="drag"`) down past the row below it, dropping near that row's bottom edge so the dragged
 * item lands after it.
 *
 * `rows` is the grid's row collection (in display order); the row is matched by visible text so
 * callers can pass just the item name even when the row also renders a description.
 */
export async function dragGridRowDownByName(
	page: Page,
	rows: Locator,
	name: string,
): Promise<void> {
	const texts = await rows.allInnerTexts();
	const index = texts.findIndex((text) => text.includes(name));
	if (index === -1) {
		throw new Error(`Row "${name}" not found in grid.`);
	}
	if (index + 1 >= texts.length) {
		throw new Error(`No row below "${name}" to move past.`);
	}

	const handle = rows.nth(index).locator('button[slot="drag"]');
	// Coordinate-based mouse moves do not auto-scroll, so bring the handle into view first.
	await handle.scrollIntoViewIfNeeded();

	const handleBox = await handle.boundingBox();
	const belowBox = await rows.nth(index + 1).boundingBox();
	if (handleBox == null || belowBox == null) {
		throw new Error("Could not resolve bounding boxes for reorder.");
	}

	const startX = handleBox.x + handleBox.width / 2;
	const startY = handleBox.y + handleBox.height / 2;
	const dropY = belowBox.y + belowBox.height - 4;

	const dragging = page.locator('[data-dragging="true"]').first();
	const { mouse } = page;
	// React Aria's pointer drag-and-drop needs real gaps between pointer events (firing them
	// back-to-back does not register the drag), so the moves are paced.
	// oxlint-disable-next-line playwright/no-wait-for-timeout
	const pause = (): Promise<void> => page.waitForTimeout(120);

	await mouse.move(startX, startY);
	await mouse.down();
	await pause();
	await mouse.move(startX, startY + 8);
	await pause();
	await dragging.waitFor({ state: "visible" });
	await mouse.move(startX, (startY + dropY) / 2);
	await pause();
	await mouse.move(startX, dropY);
	await pause();
	await mouse.up();
	// Wait for the drop to complete so the reordered list has rendered.
	await dragging.waitFor({ state: "hidden" });
}
