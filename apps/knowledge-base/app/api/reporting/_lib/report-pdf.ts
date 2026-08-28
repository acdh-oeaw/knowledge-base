import PDFDocument from "pdfkit";

import { loadDariahWordmark } from "@/app/api/reporting/_lib/report-logo";

/**
 * Branding shown in the top-right of the first page: a rasterized logo, or — when the unit has no
 * logo — its name (and acronym) rendered as text.
 */
export interface ReportPdfBrand {
	logoPng: Buffer | null;
	name: string;
	acronym: string | null;
}

export interface ReportPdfHeader {
	/** Subject of the report, e.g. the country or working-group name. */
	subject: string;
	/** Short facts rendered as a single muted line, e.g. ["Report 2025", "Status: Accepted"]. */
	meta: Array<string>;
	brand: ReportPdfBrand;
}

export interface DefinitionRow {
	label: string;
	value: string;
}

export interface ListItem {
	primary: string;
	secondary?: string;
	/** Right-aligned trailing text, e.g. an amount. */
	trailing?: string;
}

export interface KpiCard {
	title: string;
	subtitle?: string;
	/** Right-aligned muted badge next to the title, e.g. a cost bucket. */
	badge?: string;
	kpis: Array<{ label: string; value: string }>;
	/** Shown when there are no KPIs. */
	emptyLabel?: string;
}

export interface CostLine {
	label: string;
	meta?: string;
	total: string;
}

export interface QaItem {
	question: string;
	answer: string;
}

export type ReportBlock =
	| { kind: "heading"; text: string }
	| { kind: "definitionList"; rows: Array<DefinitionRow> }
	| { kind: "itemList"; items: Array<ListItem> }
	| { kind: "cards"; cards: Array<KpiCard> }
	| {
			kind: "costTable";
			total: { label: string; value: string };
			threshold: { label: string; value: string };
			lines: Array<CostLine>;
			emptyLabel: string;
	  }
	| { kind: "qa"; items: Array<QaItem> }
	| { kind: "paragraphs"; paragraphs: Array<{ text: string; muted?: boolean }> };

const COLOR = {
	fg: "#111827",
	body: "#374151",
	muted: "#6B7280",
	border: "#E5E7EB",
	divider: "#D1D5DB",
	cardFill: "#F9FAFB",
} as const;

const logoPath =
	"M49.33 24.729c0-10.093 12.994-16.333 21.548-21.516 6.721 4.093 22.397 11.499 22.4 22.119.004 11.79-4.904 31.006-8.806 31.09-4.246.093-10.11-24.356-13.232-24.292-3.12.066-8.929 24.39-12.845 24.385-4.25-.006-9.066-20.801-9.066-31.786M14.52 81.667C4.92 78.545 3.003 64.259.716 54.523c5.97-5.13 17.857-17.75 27.96-14.471 11.212 3.64 27.972 14.244 26.844 17.983-1.22 4.065-26.289 2.089-27.19 5.077-.905 2.988 20.437 16.03 19.221 19.753-1.319 4.039-22.584 2.195-33.032-1.198m43.393 50.699c-5.935 8.163-20.11 5.572-30.079 4.74-3.033-7.261-11.36-22.47-5.123-31.062 6.93-9.54 22.193-22.2 25.4-19.975 3.487 2.416-6.138 25.646-3.573 27.428C47.1 115.282 66.1 99.014 69.263 101.32c3.432 2.502-4.894 22.157-11.35 31.045m56.32-92.13c9.601-3.12 19.548 7.312 27.123 13.847-1.815 7.656-4.014 24.854-14.113 28.138-11.213 3.648-31.004 4.919-32.29 1.234-1.402-4.01 20.04-17.146 19.014-20.093-1.024-2.947-25.958-.953-27.16-4.68-1.31-4.047 16.981-15.05 27.425-18.446";

type Doc = PDFKit.PDFDocument;

interface Row {
	height: number;
	render: (top: number) => void;
}

function collectPdf(document: Doc): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const chunks: Array<Buffer> = [];

		document.on("data", (chunk: Buffer) => {
			chunks.push(chunk);
		});
		document.on("end", () => {
			const buffer = Buffer.concat(chunks);
			const arrayBuffer = new ArrayBuffer(buffer.byteLength);

			new Uint8Array(arrayBuffer).set(buffer);
			resolve(arrayBuffer);
		});
		document.on("error", reject);
	});
}

function left(document: Doc): number {
	return document.page.margins.left;
}

function right(document: Doc): number {
	return document.page.width - document.page.margins.right;
}

function contentWidth(document: Doc): number {
	return right(document) - left(document);
}

function pageBottom(document: Doc): number {
	return document.page.height - document.page.margins.bottom;
}

function ensureSpace(document: Doc, height: number): void {
	if (document.y + height > pageBottom(document)) {
		document.addPage();
	}
}

function drawDariahLogo(document: Doc, x: number, y: number, size: number): void {
	const scale = size / 142;

	document.save().translate(x, y).scale(scale).fillColor(COLOR.fg).path(logoPath).fill().restore();
}

function drawDivider(document: Doc): void {
	document
		.moveTo(left(document), document.y)
		.lineTo(right(document), document.y)
		.lineWidth(1)
		.strokeColor(COLOR.divider)
		.stroke();
}

function drawHeader(document: Doc, header: ReportPdfHeader, dariahLogo: Buffer | null): void {
	const x = left(document);
	const top = document.page.margins.top;
	const logoRowHeight = 48;

	if (dariahLogo != null) {
		try {
			// The wordmark is wide (~3.3:1); fit it within a box and let it keep its aspect ratio.
			document.image(dariahLogo, x, top, { fit: [180, 34] });
		} catch {
			drawDariahLogo(document, x, top, 36);
		}
	} else {
		drawDariahLogo(document, x, top, 36);
	}

	if (header.brand.logoPng != null) {
		const boxWidth = 160;
		const boxHeight = 48;

		try {
			document.image(header.brand.logoPng, right(document) - boxWidth, top, {
				align: "right",
				fit: [boxWidth, boxHeight],
			});
		} catch {
			// A corrupt image must not abort the document; fall through to no top-right mark.
		}
	} else {
		const boxWidth = 220;
		const label =
			header.brand.acronym == null
				? header.brand.name
				: `${header.brand.name} (${header.brand.acronym})`;

		document
			.font("Helvetica-Bold")
			.fontSize(12)
			.fillColor(COLOR.fg)
			.text(label, right(document) - boxWidth, top + 4, { align: "right", width: boxWidth });
	}

	document.y = top + logoRowHeight + 18;

	document
		.font("Helvetica-Bold")
		.fontSize(20)
		.fillColor(COLOR.fg)
		.text(header.subject, x, document.y, { width: contentWidth(document) });

	if (header.meta.length > 0) {
		document.moveDown(0.35);
		document
			.font("Helvetica")
			.fontSize(9.5)
			.fillColor(COLOR.muted)
			.text(header.meta.join("   ·   "), { width: contentWidth(document) });
	}

	document.moveDown(0.9);
	drawDivider(document);
	document.moveDown(0.4);
}

function drawHeading(document: Doc, text: string): void {
	// Extra breathing room above each section heading.
	document.moveDown(1);
	// Keep-with-next: reserve room for the heading plus the first rows of its content so a heading
	// never sits alone at the bottom of a page.
	ensureSpace(document, 96);
	document
		.font("Helvetica-Bold")
		.fontSize(13)
		.fillColor(COLOR.fg)
		.text(text, left(document), document.y, { width: contentWidth(document) });
	document.moveDown(0.55);
}

function drawDefinitionList(document: Doc, rows: Array<DefinitionRow>): void {
	const x = left(document);
	const labelWidth = 180;
	const valueX = x + labelWidth + 14;
	const valueWidth = contentWidth(document) - labelWidth - 14;

	for (const row of rows) {
		const labelHeight = document
			.font("Helvetica")
			.fontSize(10)
			.heightOfString(row.label, { width: labelWidth });
		const valueHeight = document
			.font("Helvetica-Bold")
			.fontSize(10)
			.heightOfString(row.value, { width: valueWidth });
		const rowHeight = Math.max(labelHeight, valueHeight);

		ensureSpace(document, rowHeight + 7);
		const y = document.y;

		document
			.font("Helvetica")
			.fontSize(10)
			.fillColor(COLOR.muted)
			.text(row.label, x, y, { width: labelWidth });
		document
			.font("Helvetica-Bold")
			.fontSize(10)
			.fillColor(COLOR.fg)
			.text(row.value, valueX, y, { width: valueWidth });

		document.y = y + rowHeight + 7;
	}

	document.moveDown(0.6);
}

/** Draws a stroked, rounded container around a list of pre-measured rows, breaking across pages. */
function drawRowGroup(document: Doc, rows: Array<Row>): void {
	const [firstRow] = rows;
	if (firstRow == null) {
		return;
	}

	const x = left(document);
	const width = contentWidth(document);

	const closeBox = (top: number, bottom: number): void => {
		if (bottom <= top) {
			return;
		}
		document
			.roundedRect(x, top, width, bottom - top, 6)
			.lineWidth(0.75)
			.strokeColor(COLOR.border)
			.stroke();
	};

	if (document.y + firstRow.height > pageBottom(document)) {
		document.addPage();
	}

	let boxTop = document.y;
	let firstInBox = true;

	for (const row of rows) {
		if (!firstInBox && document.y + row.height > pageBottom(document)) {
			closeBox(boxTop, document.y);
			document.addPage();
			boxTop = document.y;
			firstInBox = true;
		}

		if (!firstInBox) {
			document
				.moveTo(x, document.y)
				.lineTo(x + width, document.y)
				.lineWidth(0.5)
				.strokeColor(COLOR.border)
				.stroke();
		}

		// `render` positions text absolutely but pdfkit still advances `document.y` past whatever it
		// draws; capture the row top first and set `document.y` to the row's true bottom so a row
		// consumes exactly its measured height (rather than its height plus the drawn-text advance).
		const rowTop = document.y;
		row.render(rowTop);
		document.y = rowTop + row.height;
		firstInBox = false;
	}

	closeBox(boxTop, document.y);
	document.moveDown(1.1);
}

const ROW_PAD_X = 12;
const ROW_PAD_Y = 9;
const ROW_SECONDARY_GAP = 2;

function listItemRow(document: Doc, item: ListItem): Row {
	const x = left(document);
	const innerWidth = contentWidth(document) - ROW_PAD_X * 2;
	const trailingWidth = item.trailing == null ? 0 : 110;
	const primaryWidth = innerWidth - (trailingWidth === 0 ? 0 : trailingWidth + 10);

	const primaryHeight = document
		.font("Helvetica-Bold")
		.fontSize(10)
		.heightOfString(item.primary, { width: primaryWidth });
	const secondaryHeight =
		item.secondary == null
			? 0
			: ROW_SECONDARY_GAP +
				document
					.font("Helvetica")
					.fontSize(9)
					.heightOfString(item.secondary, { width: innerWidth });

	const height = ROW_PAD_Y * 2 + primaryHeight + secondaryHeight;

	return {
		height,
		render: (top) => {
			const y = top + ROW_PAD_Y;

			document
				.font("Helvetica-Bold")
				.fontSize(10)
				.fillColor(COLOR.fg)
				.text(item.primary, x + ROW_PAD_X, y, { width: primaryWidth });

			if (item.trailing != null) {
				document
					.font("Helvetica")
					.fontSize(9.5)
					.fillColor(COLOR.muted)
					.text(item.trailing, x + ROW_PAD_X + primaryWidth + 10, y, {
						align: "right",
						width: trailingWidth,
					});
			}

			if (item.secondary != null) {
				document
					.font("Helvetica")
					.fontSize(9)
					.fillColor(COLOR.muted)
					.text(item.secondary, x + ROW_PAD_X, y + primaryHeight + ROW_SECONDARY_GAP, {
						width: innerWidth,
					});
			}
		},
	};
}

function costSummaryRow(
	document: Doc,
	label: string,
	value: string,
	options: { emphasize?: boolean },
): Row {
	const x = left(document);
	const innerWidth = contentWidth(document) - ROW_PAD_X * 2;
	const valueWidth = 150;
	const labelWidth = innerWidth - valueWidth - 10;
	const valueSize = options.emphasize === true ? 14 : 10;

	const labelHeight = document
		.font("Helvetica-Bold")
		.fontSize(10)
		.heightOfString(label, { width: labelWidth });
	const valueHeight = document
		.font("Helvetica-Bold")
		.fontSize(valueSize)
		.heightOfString(value, { width: valueWidth });
	const height = 11 * 2 + Math.max(labelHeight, valueHeight);

	return {
		height,
		render: (top) => {
			const y = top + 11;

			document
				.font("Helvetica-Bold")
				.fontSize(10)
				.fillColor(COLOR.fg)
				.text(label, x + ROW_PAD_X, y, { width: labelWidth });
			document
				.font("Helvetica-Bold")
				.fontSize(valueSize)
				.fillColor(COLOR.fg)
				.text(value, x + ROW_PAD_X + labelWidth + 10, y, { align: "right", width: valueWidth });
		},
	};
}

function emptyRow(document: Doc, label: string): Row {
	const x = left(document);
	const innerWidth = contentWidth(document) - ROW_PAD_X * 2;
	const height =
		ROW_PAD_Y * 2 +
		document.font("Helvetica").fontSize(9.5).heightOfString(label, { width: innerWidth });

	return {
		height,
		render: (top) => {
			document
				.font("Helvetica")
				.fontSize(9.5)
				.fillColor(COLOR.muted)
				.text(label, x + ROW_PAD_X, top + ROW_PAD_Y, { width: innerWidth });
		},
	};
}

const KPI_COLUMNS = 3;
const KPI_CELL_HEIGHT = 28;
const CARD_PAD = 12;

function drawKpiCard(document: Doc, card: KpiCard): void {
	const x = left(document);
	const width = contentWidth(document);
	const innerWidth = width - CARD_PAD * 2;
	const badgeWidth = card.badge == null ? 0 : 130;
	const titleWidth = innerWidth - badgeWidth;

	const titleHeight = document
		.font("Helvetica-Bold")
		.fontSize(11)
		.heightOfString(card.title, { width: titleWidth });
	const subtitleHeight =
		card.subtitle == null
			? 0
			: 2 +
				document.font("Helvetica").fontSize(9).heightOfString(card.subtitle, { width: innerWidth });

	let bodyHeight: number;
	if (card.kpis.length > 0) {
		const rows = Math.ceil(card.kpis.length / KPI_COLUMNS);
		bodyHeight = 10 + rows * KPI_CELL_HEIGHT;
	} else {
		bodyHeight =
			8 +
			document
				.font("Helvetica")
				.fontSize(9.5)
				.heightOfString(card.emptyLabel ?? "—", { width: innerWidth });
	}

	const height = CARD_PAD * 2 + titleHeight + subtitleHeight + bodyHeight;

	if (document.y + height > pageBottom(document)) {
		document.addPage();
	}

	const top = document.y;
	document.roundedRect(x, top, width, height, 6).lineWidth(0.75).strokeColor(COLOR.border).stroke();

	document
		.font("Helvetica-Bold")
		.fontSize(11)
		.fillColor(COLOR.fg)
		.text(card.title, x + CARD_PAD, top + CARD_PAD, { width: titleWidth });

	if (card.badge != null) {
		document
			.font("Helvetica")
			.fontSize(9)
			.fillColor(COLOR.muted)
			.text(card.badge, x + CARD_PAD + titleWidth, top + CARD_PAD + 1, {
				align: "right",
				width: badgeWidth,
			});
	}

	let cursorY = top + CARD_PAD + titleHeight;

	if (card.subtitle != null) {
		document
			.font("Helvetica")
			.fontSize(9)
			.fillColor(COLOR.muted)
			.text(card.subtitle, x + CARD_PAD, cursorY + 2, { width: innerWidth });
		cursorY += subtitleHeight;
	}

	if (card.kpis.length > 0) {
		const gridTop = cursorY + 10;
		const columnWidth = innerWidth / KPI_COLUMNS;

		card.kpis.forEach((kpi, index) => {
			const column = index % KPI_COLUMNS;
			const rowIndex = Math.floor(index / KPI_COLUMNS);
			const cellX = x + CARD_PAD + column * columnWidth;
			const cellY = gridTop + rowIndex * KPI_CELL_HEIGHT;

			document
				.font("Helvetica")
				.fontSize(8.5)
				.fillColor(COLOR.muted)
				.text(kpi.label, cellX, cellY, { width: columnWidth - 8 });
			document
				.font("Helvetica-Bold")
				.fontSize(10)
				.fillColor(COLOR.fg)
				.text(kpi.value, cellX, cellY + 12, { width: columnWidth - 8 });
		});
	} else {
		document
			.font("Helvetica")
			.fontSize(9.5)
			.fillColor(COLOR.muted)
			.text(card.emptyLabel ?? "—", x + CARD_PAD, cursorY + 8, { width: innerWidth });
	}

	document.y = top + height;
	document.moveDown(0.6);
}

function drawQaItem(document: Doc, item: QaItem): void {
	const x = left(document);
	const width = contentWidth(document);
	const innerWidth = width - CARD_PAD * 2;

	const questionHeight = document
		.font("Helvetica-Bold")
		.fontSize(10)
		.heightOfString(item.question, { width: innerWidth });
	const boxHeight = CARD_PAD * 2 + questionHeight;

	ensureSpace(document, boxHeight + 8);

	const top = document.y;
	document.roundedRect(x, top, width, boxHeight, 6).fillAndStroke(COLOR.cardFill, COLOR.border);
	document
		.font("Helvetica-Bold")
		.fontSize(10)
		.fillColor(COLOR.fg)
		.text(item.question, x + CARD_PAD, top + CARD_PAD, { width: innerWidth });

	document.y = top + boxHeight;
	document.moveDown(0.4);

	const answerHeight = document
		.font("Helvetica")
		.fontSize(10)
		.heightOfString(item.answer, { width: innerWidth });
	ensureSpace(document, answerHeight + 4);
	document
		.font("Helvetica")
		.fontSize(10)
		.fillColor(COLOR.body)
		.text(item.answer, x + CARD_PAD, document.y, { width: innerWidth });

	document.moveDown(0.9);
}

function drawParagraphs(document: Doc, paragraphs: Array<{ text: string; muted?: boolean }>): void {
	for (const paragraph of paragraphs) {
		const height = document
			.font("Helvetica")
			.fontSize(10)
			.heightOfString(paragraph.text, { width: contentWidth(document) });
		ensureSpace(document, height + 6);
		document
			.font("Helvetica")
			.fontSize(10)
			.fillColor(paragraph.muted === true ? COLOR.muted : COLOR.body)
			.text(paragraph.text, left(document), document.y, { width: contentWidth(document) });
		document.moveDown(0.5);
	}

	document.moveDown(0.3);
}

function drawBlock(document: Doc, block: ReportBlock): void {
	switch (block.kind) {
		case "heading": {
			drawHeading(document, block.text);
			break;
		}
		case "definitionList": {
			drawDefinitionList(document, block.rows);
			break;
		}
		case "itemList": {
			drawRowGroup(
				document,
				block.items.map((item) => listItemRow(document, item)),
			);
			break;
		}
		case "cards": {
			for (const card of block.cards) {
				drawKpiCard(document, card);
			}
			break;
		}
		case "costTable": {
			const rows: Array<Row> = [
				costSummaryRow(document, block.total.label, block.total.value, { emphasize: true }),
				costSummaryRow(document, block.threshold.label, block.threshold.value, {}),
			];
			if (block.lines.length > 0) {
				for (const line of block.lines) {
					rows.push(
						listItemRow(document, {
							primary: line.label,
							secondary: line.meta,
							trailing: line.total,
						}),
					);
				}
			} else {
				rows.push(emptyRow(document, block.emptyLabel));
			}
			drawRowGroup(document, rows);
			break;
		}
		case "qa": {
			for (const item of block.items) {
				drawQaItem(document, item);
			}
			break;
		}
		case "paragraphs": {
			drawParagraphs(document, block.paragraphs);
			break;
		}
	}
}

export async function createReportPdf(
	header: ReportPdfHeader,
	blocks: Array<ReportBlock>,
): Promise<ArrayBuffer> {
	const document = new PDFDocument({
		autoFirstPage: true,
		bufferPages: false,
		margin: 50,
		size: "A4",
	});
	const pdf = collectPdf(document);

	const dariahLogo = await loadDariahWordmark();
	drawHeader(document, header, dariahLogo);

	for (const block of blocks) {
		drawBlock(document, block);
	}

	document.end();

	return pdf;
}
