"use server";

import { assert, getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { UpsertProjectPartnerActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/project-partners/_lib/upsert-project-partner.schema";
import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { arePublishedEntityDocuments } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { and, eq, ne } from "@/lib/db/sql";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { createServerAction } from "@/lib/server/create-server-action";

export const upsertProjectPartnerAction = createServerAction(
	{ requireAdmin: true },
	async function upsertProjectPartnerAction(state, formData, { user }) {
		const locale = await getLocale();
		const t = await getExtracted();
		const result = await v.safeParseAsync(
			UpsertProjectPartnerActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof UpsertProjectPartnerActionInputSchema>(result.issues);
			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { id, projectDocumentId, unitDocumentId, roleId, duration } = result.output;

		if (!(await arePublishedEntityDocuments(db, [unitDocumentId]))) {
			return createActionStateError({
				message: t("Relations can only target published entities."),
			});
		}

		const duplicate = await db
			.select({ id: schema.projectsToOrganisationalUnits.id })
			.from(schema.projectsToOrganisationalUnits)
			.where(
				and(
					id != null ? ne(schema.projectsToOrganisationalUnits.id, id) : undefined,
					eq(schema.projectsToOrganisationalUnits.projectDocumentId, projectDocumentId),
					eq(schema.projectsToOrganisationalUnits.unitDocumentId, unitDocumentId),
					eq(schema.projectsToOrganisationalUnits.roleId, roleId),
				),
			)
			.limit(1)
			.then((rows) => rows[0] ?? null);

		if (duplicate != null) {
			return createActionStateError({ message: t("This partner already exists.") });
		}

		const partnerId = await db.transaction(async (tx) => {
			const row =
				id != null
					? await tx
							.update(schema.projectsToOrganisationalUnits)
							.set({
								projectDocumentId,
								unitDocumentId,
								roleId,
								duration: duration ?? null,
							})
							.where(eq(schema.projectsToOrganisationalUnits.id, id))
							.returning({ id: schema.projectsToOrganisationalUnits.id })
							.then((rows) => rows[0])
					: await tx
							.insert(schema.projectsToOrganisationalUnits)
							.values({
								projectDocumentId,
								unitDocumentId,
								roleId,
								duration,
							})
							.returning({ id: schema.projectsToOrganisationalUnits.id })
							.then((rows) => rows[0]);

			assert(row);

			await recordAuditEvent(tx, {
				actorUserId: user?.id,
				action: id != null ? "update" : "create",
				subjectType: "project_partners",
				subjectId: row.id,
				summary: getAuditSummaryFromFormData(formData),
			});

			return row.id;
		});

		revalidatePath("/[locale]/dashboard/administrator", "layout");
		return createActionStateSuccess({ data: { id: partnerId } });
	},
);
