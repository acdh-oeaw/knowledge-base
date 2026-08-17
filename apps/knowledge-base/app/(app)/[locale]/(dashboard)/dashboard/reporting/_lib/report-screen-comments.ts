import * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";

import { db } from "@/lib/db";
import { and, eq } from "@/lib/db/sql";

export type ReportScreenCommentType = (typeof schema.reportScreenCommentTypeEnum)[number];
export type ReportScreenCommentKey = (typeof schema.reportScreenCommentKeyEnum)[number];

export async function getReportScreenComment(
	reportType: ReportScreenCommentType,
	reportId: string,
	screenKey: ReportScreenCommentKey,
): Promise<JSONContent | null> {
	const row = await db
		.select({ comment: schema.reportScreenComments.comment })
		.from(schema.reportScreenComments)
		.where(
			and(
				eq(schema.reportScreenComments.reportType, reportType),
				eq(schema.reportScreenComments.reportId, reportId),
				eq(schema.reportScreenComments.screenKey, screenKey),
			),
		)
		.limit(1);

	return row[0]?.comment ?? null;
}

export function isEmptyRichTextDocument(content: JSONContent | null | undefined): boolean {
	if (content == null) {
		return true;
	}
	if (content.type !== "doc") {
		return false;
	}

	const nodes = content.content ?? [];

	if (nodes.length === 0) {
		return true;
	}

	return nodes.every((node) => {
		if (node.type === "paragraph") {
			const paragraphContent = node.content ?? [];
			if (paragraphContent.length === 0) {
				return true;
			}

			return paragraphContent.every(
				(child) => child.type === "text" && (child.text ?? "").trim() === "",
			);
		}

		return false;
	});
}
