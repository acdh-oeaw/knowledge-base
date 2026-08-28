import type { Page } from "@playwright/test";

/**
 * Clears all segments of a React Aria DateField/DatePicker. React Aria's backspace logic deletes
 * one digit per press; once a segment is empty, the next backspace would move focus to the
 * _previous_ segment — potentially escaping the date group entirely and corrupting adjacent fields.
 * To stay scoped, re-click the segment before each backspace and stop as soon as it reads as
 * cleared (aria-valuenow becomes null).
 */
export async function clearDateSegments(page: Page, label: string): Promise<void> {
	const group = page.getByRole("group", { name: label });

	// Include the time segments: a timed picker (granularity "minute") leaves the value _partial_
	// (hence invalid, blocking submit) if only the date segments are cleared. Time segments are
	// absent on date-only pickers, so skip whatever this picker does not have.
	for (const segmentName of [/day/i, /month/i, /year/i, /hour/i, /minute/i]) {
		const segment = group.getByRole("spinbutton", { name: segmentName });
		if ((await segment.count()) === 0) {
			continue;
		}
		for (let i = 0; i < 5; i += 1) {
			const value = await segment.getAttribute("aria-valuenow");
			if (value === null) {
				break;
			}
			await segment.click();
			await page.keyboard.press("Backspace");
		}
	}
}
