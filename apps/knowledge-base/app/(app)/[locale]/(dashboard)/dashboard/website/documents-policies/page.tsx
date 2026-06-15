import * as schema from "@acdh-knowledge-base/database/schema";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { DocumentsPoliciesPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_components/documents-policies-page";
import { imageGridOptions } from "@/config/assets.config";
import { getMediaLibraryAssets } from "@/lib/data/assets";
import { latestEditableEntityVersionWhere } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { asc, eq, sql } from "@/lib/db/sql";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardWebsiteDocumentsPoliciesPageProps extends PageProps<"/[locale]/dashboard/website/documents-policies"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWebsiteDocumentsPoliciesPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Website dashboard - Documents and policies"),
	});

	return metadata;
}

export default async function DashboardWebsiteDocumentsPoliciesPage(
	_props: Readonly<DashboardWebsiteDocumentsPoliciesPageProps>,
): Promise<ReactNode> {
	const [groups, documents, { items: initialAssets }] = await Promise.all([
		db.query.documentPolicyGroups.findMany({
			orderBy: { position: "asc" },
		}),
		db
			.select({
				id: schema.documentsPolicies.id,
				title: schema.documentsPolicies.title,
				summary: schema.documentsPolicies.summary,
				url: schema.documentsPolicies.url,
				groupId: schema.documentsPolicies.groupId,
				position: schema.documentsPolicies.position,
				entityId: schema.entities.id,
				slug: schema.entities.slug,
				hasDraft: sql<boolean>`
					EXISTS (
						SELECT
							1
						FROM
							"entity_versions" AS "dv"
							INNER JOIN "entity_status" AS "ds" ON "dv"."status_id" = "ds"."id"
						WHERE
							"dv"."entity_id" = ${schema.entityVersions.entityId}
							AND "ds"."type" = 'draft'
							AND (
								NOT EXISTS (
									SELECT
										1
									FROM
										"entity_versions" AS "pv"
										INNER JOIN "entity_status" AS "ps" ON "pv"."status_id" = "ps"."id"
									WHERE
										"pv"."entity_id" = ${schema.entityVersions.entityId}
										AND "ps"."type" = 'published'
								)
								OR "dv"."updated_at" > (
									SELECT
										"pv"."updated_at"
									FROM
										"entity_versions" AS "pv"
										INNER JOIN "entity_status" AS "ps" ON "pv"."status_id" = "ps"."id"
									WHERE
										"pv"."entity_id" = ${schema.entityVersions.entityId}
										AND "ps"."type" = 'published'
									LIMIT 1
								)
							)
					)
				`,
				isPublished: sql<boolean>`EXISTS (
					SELECT 1 FROM "entity_versions" AS "published_versions"
					INNER JOIN "entity_status" AS "published_status" ON "published_versions"."status_id" = "published_status"."id"
					WHERE "published_versions"."entity_id" = ${schema.entities.id}
					AND "published_status"."type" = 'published'
				)`,
				document: { key: schema.assets.key, label: schema.assets.label },
			})
			.from(schema.documentsPolicies)
			.innerJoin(schema.entityVersions, eq(schema.documentsPolicies.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(schema.assets, eq(schema.documentsPolicies.documentId, schema.assets.id))
			.where(latestEditableEntityVersionWhere())
			.orderBy(asc(schema.documentsPolicies.position)),
		getMediaLibraryAssets({ imageUrlOptions: imageGridOptions, prefix: "documents" }),
	]);

	const documentsShaped = documents.map(({ slug, entityId, ...rest }) => {
		return { ...rest, entityVersion: { entity: { id: entityId, slug } } };
	});
	const groupsWithDocuments = groups.map((group) => {
		return {
			...group,
			documentsPolicies: documentsShaped.filter((document) => document.groupId === group.id),
		};
	});
	const ungrouped = documentsShaped.filter((document) => document.groupId == null);

	return (
		<DocumentsPoliciesPage
			groups={groupsWithDocuments}
			initialAssets={initialAssets}
			ungrouped={ungrouped}
		/>
	);
}
