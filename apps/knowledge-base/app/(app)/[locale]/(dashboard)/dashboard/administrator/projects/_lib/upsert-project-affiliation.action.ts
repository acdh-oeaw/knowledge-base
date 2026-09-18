"use server";

import { assert, getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { UpsertProjectAffiliationActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/upsert-project-affiliation.schema";
import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { arePublishedEntityDocuments } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { and, eq, ne } from "@/lib/db/sql";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { createServerAction } from "@/lib/server/create-server-action";

export const upsertProjectAffiliationAction = createServerAction(
	{ requireAdmin: true },
	async function upsertProjectAffiliationAction(state, formData, { user }) {
		const locale = await getLocale();
		const t = await getExtracted();
		const result = await v.safeParseAsync(
			UpsertProjectAffiliationActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof UpsertProjectAffiliationActionInputSchema>(result.issues);
			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { id, projectDocumentId, personDocumentId, duration } = result.output;

		if (!(await arePublishedEntityDocuments(db, [personDocumentId]))) {
			return createActionStateError({
				message: t("Relations can only target published entities."),
			});
		}

		// Person↔project affiliations always use the shared `project_roles` enum's "affiliated"
		// value — the coordinator/funder/participant roles only apply to organisations.
		const affiliatedRole = await db.query.projectRoles.findFirst({
			where: { role: "affiliated" },
			columns: { id: true },
		});
		assert(affiliatedRole, "Missing seeded affiliated project role.");

		const duplicate = await db
			.select({ id: schema.projectsToPersons.id })
			.from(schema.projectsToPersons)
			.where(
				and(
					id != null ? ne(schema.projectsToPersons.id, id) : undefined,
					eq(schema.projectsToPersons.projectDocumentId, projectDocumentId),
					eq(schema.projectsToPersons.personDocumentId, personDocumentId),
					eq(schema.projectsToPersons.roleId, affiliatedRole.id),
				),
			)
			.limit(1)
			.then((rows) => rows[0] ?? null);

		if (duplicate != null) {
			return createActionStateError({ message: t("This person is already affiliated.") });
		}

		const affiliationId = await db.transaction(async (tx) => {
			const row =
				id != null
					? await tx
							.update(schema.projectsToPersons)
							.set({
								projectDocumentId,
								personDocumentId,
								roleId: affiliatedRole.id,
								duration: duration ?? null,
							})
							.where(eq(schema.projectsToPersons.id, id))
							.returning({ id: schema.projectsToPersons.id })
							.then((rows) => rows[0])
					: await tx
							.insert(schema.projectsToPersons)
							.values({
								projectDocumentId,
								personDocumentId,
								roleId: affiliatedRole.id,
								duration,
							})
							.returning({ id: schema.projectsToPersons.id })
							.then((rows) => rows[0]);

			assert(row);

			await recordAuditEvent(tx, {
				actorUserId: user?.id,
				action: id != null ? "update" : "create",
				subjectType: "project_persons",
				subjectId: row.id,
				summary: getAuditSummaryFromFormData(formData),
			});

			return row.id;
		});

		revalidatePath("/[locale]/dashboard/administrator", "layout");
		return createActionStateSuccess({ data: { id: affiliationId } });
	},
);
