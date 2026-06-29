import { appendFileSync } from "node:fs";

import { type Transaction, schema } from "@acdh-knowledge-base/database";
import { assert } from "@acdh-oeaw/lib";

interface ParsedEvent {
	duration: {
		start: Date;
		end?: Date;
	};
	location: string;
}

const MONTHS: Record<string, number> = {
	jan: 0,
	feb: 1,
	mar: 2,
	apr: 3,
	may: 4,
	jun: 5,
	jul: 6,
	aug: 7,
	sep: 8,
	oct: 9,
	nov: 10,
	dec: 11,
};

const TZ = /^(UTC|GMT|CET|CEST|EST|EDT|PST|PDT|BST|[+-]\d{2}:?\d{2})$/i;
const DEFAULT_DATE = new Date(Date.UTC(1900, 0, 1));

function toUTC(day: number, month: number, year: number): Date {
	if (year < 100) {
		year += 2000;
	}
	return new Date(Date.UTC(year, month, day));
}

export function parseEventSummary(summary: string): ParsedEvent {
	const head: string = (summary.replaceAll("\\", "").split(":")[0] ?? "").trim();
	let start: Date | null = null;
	let end: Date | null = null;

	// Range, optional start month/year: "28.9.-1.10.2026", "24.-25.10.25", "08.-12.07.2024", "8. – 10.2.2023"
	const range =
		/(\d{1,2})\.(?:(\d{1,2})\.)?(?:(\d{2,4})\.?)?\s*[–-]\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(
			head,
		);
	// Day-first named month: "4 Oct. 2022", "29. Nov. 2022"
	const namedDM = /(\d{1,2})\.?\s+([A-Za-z]{3,})\.?\s+(\d{4})/.exec(head);
	// Month-first named, optional year: "Oct. 19", "Oct. 19 2022"
	const namedMD = /\b([A-Za-z]{3,})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/.exec(head);
	// Single numeric: "10.03.2025", "23.1.24"
	const numeric = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(head);

	if (range) {
		const sd = Number(range[1]); // start day
		const ed = Number(range[4]); // end day
		const em = Number(range[5]) - 1; // end month
		const ey = Number(range[6]); // end year
		const sm = range[2] ? Number(range[2]) - 1 : em; // start month (fallback: end's)
		const sy = range[3] ? Number(range[3]) : ey; // start year  (fallback: end's)
		start = toUTC(sd, sm, sy);
		end = toUTC(ed, em, ey);
	} else if (namedDM) {
		const month = namedDM[2] != null ? MONTHS[namedDM[2].slice(0, 3).toLowerCase()] : undefined;
		if (month !== undefined) {
			start = toUTC(Number(namedDM[1]), month, Number(namedDM[3]));
			end = start;
		}
	} else if (namedMD?.[1] != null && MONTHS[namedMD[1].slice(0, 3).toLowerCase()] !== undefined) {
		const month = MONTHS[namedMD[1].slice(0, 3).toLowerCase()];
		const year = namedMD[3] ? Number(namedMD[3]) : new Date().getUTCFullYear();
		start = month != null ? toUTC(Number(namedMD[2]), month, year) : null;
		end = start;
	} else if (numeric) {
		start = toUTC(Number(numeric[1]), Number(numeric[2]) - 1, Number(numeric[3]));
		end = start;
	}

	// Location: prefer a non-timezone parenthetical, then a bare keyword.
	const parens = [...head.matchAll(/\(([^)]+)\)/g)]
		.map((m) => (m.length > 0 ? m[1]?.trim() : undefined))
		.filter((p): p is string => p !== undefined);
	const nonTz = parens.find((p) => !TZ.test(p));
	const keyword = /\b(hybrid|online|onsite|on[- ]site|in[- ]person)\b/i.exec(head)?.[1];
	const location = (nonTz ?? keyword)?.trim() ?? "";

	start = start ?? DEFAULT_DATE;

	const duration: ParsedEvent["duration"] = { start };
	if (end && end.getTime() !== start.getTime()) {
		duration.end = end;
	}

	return { duration, location };
}

/**
 * Helper functions taken from the app/knowledge-base lib resp.
 * https://github.com/DARIAH-ERIC/knowledge-base *
 */

export async function createVersionRow(
	tx: Transaction,
	documentId: string,
	statusType: "draft" | "published",
): Promise<string> {
	const status = await tx.query.entityStatus.findFirst({
		where: { type: statusType },
		columns: { id: true },
	});
	assert(status, `Entity status "${statusType}" not found in database.`);

	const [version] = await tx
		.insert(schema.entityVersions)
		.values({ entityId: documentId, statusId: status.id })
		.returning({ id: schema.entityVersions.id });
	assert(version);

	return version.id;
}

export async function createPublishedDocument(
	tx: Transaction,
	typeId: string,
	slug: string,
): Promise<{ documentId: string; versionId: string }> {
	const [document] = await tx
		.insert(schema.entities)
		.values({ slug, typeId })
		.returning({ id: schema.entities.id });
	assert(document);

	const versionId = await createVersionRow(tx, document.id, "published");

	return { documentId: document.id, versionId };
}

export function logToFile(message: string, filepath = "migration.log"): void {
	const timestamp = new Date().toISOString();
	const line = `[${timestamp}] ${message}\n`;
	appendFileSync(filepath, line);
}

export function createSortName(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);

	if (parts.length <= 1) {
		return name;
	}

	const lastName = parts.at(-1)!;
	const firstNames = parts.slice(0, -1).join(" ");

	return `${lastName}, ${firstNames}`;
}
