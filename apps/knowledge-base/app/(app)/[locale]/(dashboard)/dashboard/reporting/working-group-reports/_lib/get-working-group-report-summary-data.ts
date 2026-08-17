import { assert } from "@acdh-oeaw/lib";
import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";

import type { WorkingGroupReportSummaryData } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/working-group-report-summary";
import { type Action, can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { alias, and, eq, inArray, sql } from "@/lib/db/sql";

export interface WorkingGroupReportData {
	id: string;
	status: string;
	workingGroup: { name: string };
	campaign: { year: number; status: string };
	summary: WorkingGroupReportSummaryData;
}

export interface WorkingGroupReportHeaderData {
	id: string;
	workingGroup: { name: string };
	campaign: { year: number };
}

export type AuthorizedWorkingGroupReportResult<T> =
	| { status: "forbidden" | "not-found" }
	| { status: "ok"; data: T };

async function getWorkingGroupReportData(id: string): Promise<WorkingGroupReportData | null> {
	const report = await db.query.workingGroupReports.findFirst({
		where: { id },
		columns: {
			id: true,
			status: true,
			numberOfMembers: true,
			mailingList: true,
			campaignId: true,
			workingGroupDocumentId: true,
		},
		with: {
			campaign: { columns: { year: true, status: true } },
			workingGroup: { columns: { name: true } },
			socialMedia: {
				columns: { id: true },
				with: { socialMedia: { columns: { name: true, url: true } } },
			},
			events: {
				columns: { id: true, title: true, date: true, url: true, role: true },
				orderBy: { date: "asc" },
			},
			answers: {
				columns: { id: true, questionId: true, answer: true },
			},
		},
	});

	if (report == null) {
		return null;
	}

	const personDocumentLifecycle = alias(schema.documentLifecycle, "person_document_lifecycle");
	const [chairs, questions] = await Promise.all([
		db
			.select({
				id: schema.personsToOrganisationalUnits.id,
				personName: schema.persons.name,
				roleType: schema.personRoleTypes.type,
			})
			.from(schema.personsToOrganisationalUnits)
			.innerJoin(
				personDocumentLifecycle,
				eq(
					personDocumentLifecycle.documentId,
					schema.personsToOrganisationalUnits.personDocumentId,
				),
			)
			.innerJoin(
				schema.persons,
				sql`${schema.persons.id} = COALESCE(${personDocumentLifecycle.draftId}, ${personDocumentLifecycle.publishedId})`,
			)
			.innerJoin(
				schema.personRoleTypes,
				eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
			)
			.where(
				and(
					// report.workingGroupDocumentId is the org-unit document id directly.
					eq(
						schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
						report.workingGroupDocumentId,
					),
					inArray(schema.personRoleTypes.type, ["is_chair_of", "is_vice_chair_of"]),
					sql`
						${schema.personsToOrganisationalUnits.duration} && tstzrange (
							MAKE_DATE(${report.campaign.year}, 1, 1)::TIMESTAMPTZ,
							MAKE_DATE(${report.campaign.year + 1}, 1, 1)::TIMESTAMPTZ
						)
					`,
				),
			)
			.orderBy(schema.persons.sortName, schema.personRoleTypes.type),
		db.query.workingGroupReportQuestions.findMany({
			where: { campaignId: report.campaignId },
			columns: { id: true, question: true, position: true },
			orderBy: { position: "asc" },
		}),
	]);

	const answerMap = new Map(report.answers.map((a) => [a.questionId, a.answer]));

	// A working group report always references a published working group.
	assert(report.workingGroup, "Working group report is missing its published working group.");

	return {
		id: report.id,
		status: report.status,
		workingGroup: report.workingGroup,
		campaign: report.campaign,
		summary: {
			numberOfMembers: report.numberOfMembers,
			mailingList: report.mailingList,
			chairs,
			socialMedia: report.socialMedia,
			events: report.events,
			questions: questions.map((q) => {
				return {
					id: q.id,
					question: q.question,
					answer: answerMap.get(q.id) ?? null,
				};
			}),
		},
	};
}

async function getWorkingGroupReportHeader(
	id: string,
): Promise<WorkingGroupReportHeaderData | null> {
	const report = await db.query.workingGroupReports.findFirst({
		where: { id },
		columns: { id: true },
		with: {
			campaign: { columns: { year: true } },
			workingGroup: { columns: { name: true } },
		},
	});

	if (report == null) {
		return null;
	}

	// A working group report always references a published working group.
	assert(report.workingGroup, "Working group report is missing its published working group.");

	return {
		id: report.id,
		workingGroup: report.workingGroup,
		campaign: report.campaign,
	};
}

export async function getWorkingGroupReportDataForUser(
	user: User,
	id: string,
	action: Extract<Action, "read" | "update"> = "read",
): Promise<AuthorizedWorkingGroupReportResult<WorkingGroupReportData>> {
	return getAuthorizedWorkingGroupReportForUser(user, id, getWorkingGroupReportData, action);
}

export async function getWorkingGroupReportHeaderForUser(
	user: User,
	id: string,
	action: Extract<Action, "read" | "update"> = "read",
): Promise<AuthorizedWorkingGroupReportResult<WorkingGroupReportHeaderData>> {
	return getAuthorizedWorkingGroupReportForUser(user, id, getWorkingGroupReportHeader, action);
}

export async function getAuthorizedWorkingGroupReportForUser<T>(
	user: User,
	id: string,
	load: (id: string) => Promise<T | null>,
	action: Extract<Action, "read" | "update"> = "read",
): Promise<AuthorizedWorkingGroupReportResult<T>> {
	const header = await getWorkingGroupReportHeader(id);

	if (header == null) {
		return { status: "not-found" };
	}

	const allowed = await can(user, action, { type: "working_group_report", id });

	if (!allowed) {
		return { status: "forbidden" };
	}

	const report = await load(id);

	if (report == null) {
		return { status: "not-found" };
	}

	return { status: "ok", data: report };
}
