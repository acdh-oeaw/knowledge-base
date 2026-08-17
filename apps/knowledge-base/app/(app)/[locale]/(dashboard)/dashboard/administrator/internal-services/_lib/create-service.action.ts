"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { CreateServiceActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-services/_lib/create-service.schema";
import { arePublishedEntityDocuments } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const createServiceAction = createMutationAction({
	schema: CreateServiceActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "internal_services" },
	revalidate: "/[locale]/dashboard/administrator/internal-services",
	redirect: "/dashboard/administrator/internal-services",

	async preCheck({ input }) {
		const t = await getExtracted();
		const unitDocumentIds = [
			...new Set([...input.ownerUnitDocumentIds, ...input.providerUnitDocumentIds]),
		];

		if (!(await arePublishedEntityDocuments(db, unitDocumentIds))) {
			return createActionStateError({
				message: t("Relations can only target published entities."),
			});
		}

		return undefined;
	},

	async mutate(tx, input) {
		const [serviceType] = await tx
			.select()
			.from(schema.serviceTypes)
			.where(eq(schema.serviceTypes.type, "internal"));
		assert(serviceType);

		const [service] = await tx
			.insert(schema.services)
			.values({
				name: input.name,
				typeId: serviceType.id,
				statusId: input.statusId,
				comment: input.comment,
				dariahBranding: input.dariahBranding,
				monitoring: input.monitoring,
				metadata: input.metadata ?? {},
				privateSupplier: input.privateSupplier,
			})
			.returning({ id: schema.services.id });
		assert(service);

		const ownerRole = await tx.query.organisationalUnitServiceRoles.findFirst({
			where: { role: "service_owner" },
			columns: { id: true },
		});

		const providerRole = await tx.query.organisationalUnitServiceRoles.findFirst({
			where: { role: "service_provider" },
			columns: { id: true },
		});

		const relations: Array<typeof schema.servicesToOrganisationalUnits.$inferInsert> = [];

		if (ownerRole != null) {
			for (const organisationalUnitDocumentId of input.ownerUnitDocumentIds) {
				relations.push({
					serviceId: service.id,
					organisationalUnitDocumentId,
					roleId: ownerRole.id,
				});
			}
		}

		if (providerRole != null) {
			for (const organisationalUnitDocumentId of input.providerUnitDocumentIds) {
				relations.push({
					serviceId: service.id,
					organisationalUnitDocumentId,
					roleId: providerRole.id,
				});
			}
		}

		if (relations.length > 0) {
			await tx.insert(schema.servicesToOrganisationalUnits).values(relations);
		}

		return { subjectId: service.id };
	},
});
