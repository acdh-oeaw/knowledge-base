import * as fs from "node:fs/promises";
import * as path from "node:path";

import { assert } from "@acdh-oeaw/lib";

/**
 * The review format for the `data:backfill:*` scripts. A TSV rather than JSON because the point is
 * that a human opens it in a spreadsheet, corrects the proposed target, and hands it back.
 */

function toTsvCell(value: string): string {
	return value.replaceAll("\t", " ").replaceAll(/\r?\n/g, " ");
}

export async function writeTsvReport(
	filePath: string,
	columns: ReadonlyArray<string>,
	rows: ReadonlyArray<ReadonlyArray<string>>,
): Promise<void> {
	const serialised = rows.map((cells) => cells.map((cell) => toTsvCell(cell)).join("\t"));

	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(
		filePath,
		`${columns.join("\t")}\n${serialised.join("\n")}${serialised.length > 0 ? "\n" : ""}`,
		{ encoding: "utf-8" },
	);
}

/**
 * Reads a report back as records keyed by column name, so a reviewer can reorder or annotate
 * columns without breaking the parse. Only the columns a script asks for are required to be
 * present.
 */
export async function readTsvReport(
	filePath: string,
	requiredColumns: ReadonlyArray<string>,
): Promise<Array<Record<string, string>>> {
	const content = await fs.readFile(filePath, { encoding: "utf-8" });
	const [header, ...lines] = content.trim().split(/\r?\n/);

	assert(header != null, `Empty report: \`${filePath}\`.`);

	const columns = header.split("\t");

	for (const required of requiredColumns) {
		assert(columns.includes(required), `Report is missing the \`${required}\` column.`);
	}

	return lines.map((line) => {
		const cells = line.split("\t");

		return Object.fromEntries(
			columns.map((column, index) => [column, cells[index]?.trim() ?? ""] as const),
		);
	});
}
