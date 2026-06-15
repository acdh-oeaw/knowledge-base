import * as schema from "@acdh-knowledge-base/database/schema";
import type { ResourceItem, SearchResourcesParams } from "@acdh-knowledge-base/search";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { db } from "@/lib/db";
import { and, eq, sql } from "@/lib/db/sql";
import { search } from "@/lib/search";

type LiveResourceKind = "country" | "workingGroup";

interface LiveReportResourcesProps {
	reportId: string;
	reportKind: LiveResourceKind;
}

interface LiveResourceSection {
	description: string;
	emptyMessage: string;
	items: Array<ResourceItem>;
	title: string;
}

function quoteFilterValue(value: string): string {
	return `\`${value.replaceAll("`", "\\`")}\``;
}

async function searchAllResources(params: SearchResourcesParams): Promise<Array<ResourceItem>> {
	const firstResult = await search.collections.resources.search({ ...params, page: 1 });

	if (firstResult.isErr()) {
		throw firstResult.error;
	}

	const remainingResults = await Promise.all(
		Array.from({ length: Math.max(firstResult.value.pagination.totalPages - 1, 0) }, (_, index) =>
			search.collections.resources.search({ ...params, page: index + 2 }),
		),
	);

	return [
		...firstResult.value.items,
		...remainingResults.flatMap((result) => {
			if (result.isErr()) {
				throw result.error;
			}

			return result.value.items;
		}),
	];
}

async function getCountryNationalConsortiumSlugs(
	countryDocumentId: string,
	year: number,
): Promise<Array<string>> {
	const rows = await db
		.select({ slug: schema.entities.slug })
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.innerJoin(
			schema.entities,
			eq(schema.entities.id, schema.organisationalUnitsRelations.unitDocumentId),
		)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.entities.id),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.where(
			and(
				// unit↔unit relations and the report's country are both document-level.
				eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, countryDocumentId),
				eq(schema.organisationalUnitStatus.status, "is_national_consortium_of"),
				eq(
					schema.organisationalUnitTypes.type,
					"national_consortium" as typeof schema.organisationalUnitTypes.$inferSelect.type,
				),
				sql`
					${schema.organisationalUnitsRelations.duration} && tstzrange (
						MAKE_DATE(${year}, 1, 1)::TIMESTAMPTZ,
						MAKE_DATE(${year + 1}, 1, 1)::TIMESTAMPTZ
					)
				`,
			),
		);

	return rows.map((row) => row.slug);
}

async function getWorkingGroupSlug(workingGroupDocumentId: string): Promise<string | null> {
	const rows = await db
		.select({ slug: schema.entities.slug })
		.from(schema.entities)
		.where(eq(schema.entities.id, workingGroupDocumentId))
		.limit(1);

	return rows[0]?.slug ?? null;
}

async function getCountrySections(reportId: string): Promise<Array<LiveResourceSection>> {
	const t = await getExtracted();
	const report = await db.query.countryReports.findFirst({
		where: { id: reportId },
		columns: { countryDocumentId: true },
		with: { campaign: { columns: { year: true } } },
	});

	if (report == null) {
		return [];
	}

	const consortiumSlugs = await getCountryNationalConsortiumSlugs(
		report.countryDocumentId,
		report.campaign.year,
	);
	const consortiumFilter = `[${consortiumSlugs.map(quoteFilterValue).join(",")}]`;

	if (consortiumSlugs.length === 0) {
		return [
			{
				description: t(
					"Live SSH Open Marketplace software filtered by campaign year and actor identifier.",
				),
				emptyMessage: t("This country has no national consortium for the selected campaign year."),
				items: [],
				title: t("SSHOC software"),
			},
			{
				description: t("Live Zotero publications filtered by campaign year and actor identifier."),
				emptyMessage: t("This country has no national consortium for the selected campaign year."),
				items: [],
				title: t("Zotero publications"),
			},
		];
	}

	const baseParams = {
		perPage: 100,
		query: "*",
		queryBy: ["label", "description", "keywords"],
		sortBy: [{ field: "label", direction: "asc" }],
	} satisfies Partial<SearchResourcesParams>;

	const [software, publications] = await Promise.all([
		searchAllResources({
			...baseParams,
			filterBy: `type:=software && source:=ssh-open-marketplace && national_consortia:=${consortiumFilter}`,
		}),
		searchAllResources({
			...baseParams,
			filterBy: `type:=publication && source:=zotero && year:=${report.campaign.year} && national_consortia:=${consortiumFilter}`,
		}),
	]);

	return [
		{
			description: t(
				"Live SSH Open Marketplace software filtered by campaign year and actor identifier.",
			),
			emptyMessage: t("No SSH Open Marketplace software found for this country."),
			items: software,
			title: t("SSHOC software"),
		},
		{
			description: t("Live Zotero publications filtered by campaign year and actor identifier."),
			emptyMessage: t("No Zotero publications found for this reporting year."),
			items: publications,
			title: t("Zotero publications"),
		},
	];
}

async function getWorkingGroupSections(reportId: string): Promise<Array<LiveResourceSection>> {
	const t = await getExtracted();
	const report = await db.query.workingGroupReports.findFirst({
		where: { id: reportId },
		columns: { workingGroupDocumentId: true },
		with: { campaign: { columns: { year: true } } },
	});

	if (report == null) {
		return [];
	}

	const slug = await getWorkingGroupSlug(report.workingGroupDocumentId);

	if (slug == null) {
		return [
			{
				description: t(
					"Live SSH Open Marketplace resources filtered by campaign year and actor identifier.",
				),
				emptyMessage: t("No working group actor identifier is available for this report."),
				items: [],
				title: t("SSHOC resources"),
			},
			{
				description: t("Live Zotero publications filtered by campaign year and actor identifier."),
				emptyMessage: t("No working group actor identifier is available for this report."),
				items: [],
				title: t("Zotero publications"),
			},
		];
	}

	const workingGroupFilter = `[${quoteFilterValue(slug)}]`;
	const baseParams = {
		perPage: 100,
		query: "*",
		queryBy: ["label", "description", "keywords"],
		sortBy: [{ field: "label", direction: "asc" }],
	} satisfies Partial<SearchResourcesParams>;

	const [resources, publications] = await Promise.all([
		searchAllResources({
			...baseParams,
			filterBy: `source:=ssh-open-marketplace && working_groups:=${workingGroupFilter}`,
		}),
		searchAllResources({
			...baseParams,
			filterBy: `type:=publication && source:=zotero && year:=${report.campaign.year} && working_groups:=${workingGroupFilter}`,
		}),
	]);

	return [
		{
			description: t(
				"Live SSH Open Marketplace resources filtered by campaign year and actor identifier.",
			),
			emptyMessage: t("No SSH Open Marketplace resources found for this working group."),
			items: resources,
			title: t("SSHOC resources"),
		},
		{
			description: t("Live Zotero publications filtered by campaign year and actor identifier."),
			emptyMessage: t("No Zotero publications found for this reporting year."),
			items: publications,
			title: t("Zotero publications"),
		},
	];
}

function ResourceList({ items }: Readonly<{ items: Array<ResourceItem> }>): ReactNode {
	return (
		<ul className="flex flex-col gap-y-3">
			{items.map(({ document }) => (
				<li key={document.id} className="rounded-md border border-border p-4">
					<div className="flex flex-col gap-y-2">
						{document.links[0] != null ? (
							<a
								className="text-sm font-semibold text-fg underline-offset-4 hover:underline"
								href={document.links[0]}
								rel="noreferrer"
								target="_blank"
							>
								{document.label}
							</a>
						) : (
							<p className="text-sm font-semibold text-fg">{document.label}</p>
						)}
						<p className="text-xs text-muted-fg">
							{[document.source, document.type, document.year, document.kind]
								.filter(Boolean)
								.join(" · ")}
						</p>
						{document.description !== "" ? (
							<p className="line-clamp-3 text-sm text-muted-fg">{document.description}</p>
						) : null}
					</div>
				</li>
			))}
		</ul>
	);
}

export async function LiveReportResources(
	props: Readonly<LiveReportResourcesProps>,
): Promise<ReactNode> {
	const { reportId, reportKind } = props;
	const t = await getExtracted();
	const sections =
		reportKind === "country"
			? await getCountrySections(reportId)
			: await getWorkingGroupSections(reportId);

	return (
		<section className="flex flex-col gap-y-4">
			<div className="flex flex-col gap-y-1">
				<h2 className="text-sm font-semibold text-fg">{t("Live external data")}</h2>
				<p className="text-sm text-muted-fg">
					{t(
						"This fetches current search-index data on demand. These results are not stored as a report snapshot in the database.",
					)}
				</p>
			</div>

			<div className="flex flex-col gap-y-8">
				{sections.map((section) => (
					<section key={section.title} className="flex flex-col gap-y-3">
						<div className="flex flex-col gap-y-1">
							<h3 className="text-sm font-semibold text-fg">{section.title}</h3>
							<p className="text-xs text-muted-fg">{section.description}</p>
						</div>
						{section.items.length > 0 ? (
							<ResourceList items={section.items} />
						) : (
							<p className="text-sm text-muted-fg italic">{section.emptyMessage}</p>
						)}
					</section>
				))}
			</div>
		</section>
	);
}

export function LiveReportResourcesFallback(
	props: Readonly<{ description: string; loadingLabel: string; title: string }>,
): ReactNode {
	return (
		<section className="flex flex-col gap-y-4">
			<div className="flex flex-col gap-y-1">
				<h2 className="text-sm font-semibold text-fg">{props.title}</h2>
				<p className="text-sm text-muted-fg">{props.description}</p>
			</div>
			<p className="text-sm text-muted-fg">{props.loadingLabel}</p>
		</section>
	);
}
