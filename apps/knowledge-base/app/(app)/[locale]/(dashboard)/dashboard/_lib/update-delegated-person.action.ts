"use server";

import { assert, getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { assertCanEditPerson } from "@/app/(app)/[locale]/(dashboard)/dashboard/_lib/authorize-delegated-person";
import { recordAuditEvent } from "@/lib/audit/audit-log";
import { ensureDraftVersion, touchVersion } from "@/lib/data/entity-lifecycle";
import { personsLifecycleAdapter } from "@/lib/data/persons.lifecycle-adapter";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { createServerAction } from "@/lib/server/create-server-action";

const UpdateDelegatedPersonActionInputSchema = v.object({
	documentId: v.pipe(v.string(), v.uuid()),
	name: v.pipe(v.string(), v.nonEmpty()),
	sortName: v.pipe(v.string(), v.nonEmpty()),
});

/**
 * Edits a person's core metadata as a draft. A delegated caller (working-group chair, national
 * coordinator) may edit a person who appears in a unit they manage; publishing remains an admin
 * task.
 */
export const updateDelegatedPersonAction = createServerAction(
	{ requireAuth: true },
	async function updateDelegatedPersonAction(state, formData, { user }) {
		const locale = await getLocale();
		const t = await getExtracted();

		const result = await v.safeParseAsync(
			UpdateDelegatedPersonActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof UpdateDelegatedPersonActionInputSchema>(result.issues);
			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { documentId, name, sortName } = result.output;

		assert(user != null);
		await assertCanEditPerson(user, documentId);

		await db.transaction(async (tx) => {
			const draftVersionId = await ensureDraftVersion(tx, documentId, personsLifecycleAdapter);

			await tx
				.update(schema.persons)
				.set({ name, sortName })
				.where(eq(schema.persons.id, draftVersionId));

			await touchVersion(tx, draftVersionId);

			await recordAuditEvent(tx, {
				actorUserId: user.id,
				action: "update",
				subjectType: "persons",
				subjectId: documentId,
				summary: { name, sortName, lifecycle: "draft" },
			});
		});

		revalidatePath("/[locale]/dashboard", "layout");

		return createActionStateSuccess({ data: { name, sortName } });
	},
);
