import * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";

import { db } from "@/lib/db";
import { and, eq } from "@/lib/db/sql";

export type ReportScreenCommentType = (typeof schema.reportScreenCommentTypeEnum)[number];
export type ReportScreenCommentKey = (typeof schema.reportScreenCommentKeyEnum)[number];

export interface ReportScreenCommentView {
	screenKey: ReportScreenCommentKey;
	comment: JSONContent;
}

const screenKeysByReportType: Record<
	ReportScreenCommentType,
	ReadonlyArray<ReportScreenCommentKey>
> = {
	country: [
		"contributors",
		"institutions",
		"events",
		"social-media",
		"services",
		"software",
		"publications",
		"projects",
		"confirm",
	],
	working_group: ["confirm", "data", "events", "questions"],
};

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

export async function getReportScreenComments(
	reportType: ReportScreenCommentType,
	reportId: string,
): Promise<Array<ReportScreenCommentView>> {
	const rows = await db
		.select({
			screenKey: schema.reportScreenComments.screenKey,
			comment: schema.reportScreenComments.comment,
		})
		.from(schema.reportScreenComments)
		.where(
			and(
				eq(schema.reportScreenComments.reportType, reportType),
				eq(schema.reportScreenComments.reportId, reportId),
			),
		);

	const commentsByScreenKey = new Map(rows.map((row) => [row.screenKey, row.comment]));

	return screenKeysByReportType[reportType].flatMap((screenKey) => {
		const comment = commentsByScreenKey.get(screenKey);

		return comment == null || isEmptyRichTextDocument(comment) ? [] : [{ screenKey, comment }];
	});
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
