"use server";

import * as schema from "@acdh-knowledge-base/database/schema";
import {
	createActionStateError,
	createActionStateSuccess,
} from "@acdh-knowledge-base/next-lib/actions";
import { assert, getFormDataValues } from "@acdh-oeaw/lib";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { UpsertProjectPersonActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/project-persons/_lib/upsert-project-person.schema";
import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { arePublishedEntityDocuments } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { and, eq, ne } from "@/lib/db/sql";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { createServerAction } from "@/lib/server/create-server-action";

export const upsertProjectPersonAction = createServerAction(
	{ requireAdmin: true },
	async function upsertProjectPersonAction(state, formData, { user }) {
		const locale = await getLocale();
		const t = await getExtracted();
		const result = await v.safeParseAsync(
			UpsertProjectPersonActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof UpsertProjectPersonActionInputSchema>(result.issues);
			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { id, projectDocumentId, personDocumentId, roleId, duration } = result.output;

		if (!(await arePublishedEntityDocuments(db, [personDocumentId]))) {
			return createActionStateError({
				message: t("Relations can only target published entities."),
			});
		}

		const duplicate = await db
			.select({ id: schema.projectsToPersons.id })
			.from(schema.projectsToPersons)
			.where(
				and(
					id != null ? ne(schema.projectsToPersons.id, id) : undefined,
					eq(schema.projectsToPersons.projectDocumentId, projectDocumentId),
					eq(schema.projectsToPersons.personDocumentId, personDocumentId),
					eq(schema.projectsToPersons.roleId, roleId),
				),
			)
			.limit(1)
			.then((rows) => rows[0] ?? null);

		if (duplicate != null) {
			return createActionStateError({ message: t("This person already exists.") });
		}

		const personId = await db.transaction(async (tx) => {
			const row =
				id != null
					? await tx
							.update(schema.projectsToPersons)
							.set({
								projectDocumentId,
								personDocumentId,
								roleId,
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
								roleId,
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
		return createActionStateSuccess({ data: { id: personId } });
	},
);
