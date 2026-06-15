import { type CalendarDate, parseDate } from "@internationalized/date";

/**
 * Duration dates are stored and displayed as UTC throughout the app: the calendar date the editor
 * picks is the calendar date everyone sees, regardless of browser timezone. So the `CalendarDate`
 * <-> `Date` conversions must go through UTC, not the local timezone — read the UTC date out of the
 * `Date` with this helper, and write it back with `value.toDate("UTC")` (never
 * `value.toDate(getLocalTimeZone())`, which would shift the day for editors east/west of UTC).
 *
 * Events follow the same convention; they would only need timezone-aware handling if we stored a
 * per-event timezone.
 */
export function dateToCalendarDate(date: Date | null | undefined): CalendarDate | null {
	return date != null ? parseDate(date.toISOString().slice(0, 10)) : null;
}
