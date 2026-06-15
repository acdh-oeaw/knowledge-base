import PDFDocument from "pdfkit";

export interface PdfSection {
	title: string;
	lines: Array<string>;
}

const logoPath =
	"M49.33 24.729c0-10.093 12.994-16.333 21.548-21.516 6.721 4.093 22.397 11.499 22.4 22.119.004 11.79-4.904 31.006-8.806 31.09-4.246.093-10.11-24.356-13.232-24.292-3.12.066-8.929 24.39-12.845 24.385-4.25-.006-9.066-20.801-9.066-31.786M14.52 81.667C4.92 78.545 3.003 64.259.716 54.523c5.97-5.13 17.857-17.75 27.96-14.471 11.212 3.64 27.972 14.244 26.844 17.983-1.22 4.065-26.289 2.089-27.19 5.077-.905 2.988 20.437 16.03 19.221 19.753-1.319 4.039-22.584 2.195-33.032-1.198m43.393 50.699c-5.935 8.163-20.11 5.572-30.079 4.74-3.033-7.261-11.36-22.47-5.123-31.062 6.93-9.54 22.193-22.2 25.4-19.975 3.487 2.416-6.138 25.646-3.573 27.428C47.1 115.282 66.1 99.014 69.263 101.32c3.432 2.502-4.894 22.157-11.35 31.045m56.32-92.13c9.601-3.12 19.548 7.312 27.123 13.847-1.815 7.656-4.014 24.854-14.113 28.138-11.213 3.648-31.004 4.919-32.29 1.234-1.402-4.01 20.04-17.146 19.014-20.093-1.024-2.947-25.958-.953-27.16-4.68-1.31-4.047 16.981-15.05 27.425-18.446";

function normalizeText(value: string): string {
	return value.replaceAll(/\s+/g, " ").trim();
}

function collectPdf(document: PDFKit.PDFDocument): Promise<ArrayBuffer> {
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

function drawLogo(document: PDFKit.PDFDocument, x: number, y: number, size: number): void {
	const scale = size / 142;

	document.save().translate(x, y).scale(scale).fillColor("#111827").path(logoPath).fill().restore();
}

function addHeader(document: PDFKit.PDFDocument, title: string): void {
	const logoSize = 34;
	const gap = 12;
	const rowY = document.page.margins.top;
	const titleX = document.page.margins.left + logoSize + gap;
	const titleWidth = document.page.width - document.page.margins.right - titleX;

	document.fillColor("#111827").font("Helvetica-Bold").fontSize(18);

	const textHeight = document.heightOfString(normalizeText(title), {
		lineGap: 2,
		width: titleWidth,
	});
	const rowHeight = Math.max(logoSize, textHeight);
	const logoY = rowY + (rowHeight - logoSize) / 2;
	const titleY = rowY + (rowHeight - textHeight) / 2;

	drawLogo(document, document.page.margins.left, logoY, logoSize);

	document
		.fillColor("#111827")
		.font("Helvetica-Bold")
		.fontSize(18)
		.text(normalizeText(title), titleX, titleY, {
			lineGap: 2,
			width: titleWidth,
		});

	document.y = rowY + rowHeight + 22;
	document
		.moveTo(document.page.margins.left, document.y)
		.lineTo(document.page.width - document.page.margins.right, document.y)
		.strokeColor("#D1D5DB")
		.lineWidth(1)
		.stroke();
	document.moveDown(1.5);
}

function ensureSpace(document: PDFKit.PDFDocument, height: number): void {
	if (document.y + height > document.page.height - document.page.margins.bottom) {
		document.addPage();
	}
}

function addSection(document: PDFKit.PDFDocument, section: PdfSection): void {
	ensureSpace(document, 64);

	document
		.fillColor("#111827")
		.font("Helvetica-Bold")
		.fontSize(13)
		.text(normalizeText(section.title));

	document.moveDown(0.45);

	for (const line of section.lines) {
		ensureSpace(document, 30);
		document.fillColor("#374151").font("Helvetica").fontSize(10).text(normalizeText(line), {
			lineGap: 2,
		});
	}

	document.moveDown(1.1);
}

export async function createTextPdf(
	title: string,
	sections: Array<PdfSection>,
): Promise<ArrayBuffer> {
	const document = new PDFDocument({
		autoFirstPage: true,
		bufferPages: false,
		margin: 50,
		size: "A4",
	});
	const pdf = collectPdf(document);

	addHeader(document, title);

	for (const section of sections) {
		addSection(document, section);
	}

	document.end();

	return pdf;
}
