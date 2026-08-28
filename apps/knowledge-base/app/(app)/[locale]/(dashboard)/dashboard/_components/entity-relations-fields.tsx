"use client";

import { AsyncListSelect } from "@dariah-eric/ui/async-list-select";
import { Separator } from "@dariah-eric/ui/separator";
import type { AsyncOption, AsyncOptionsFetchPageParams } from "@dariah-eric/ui/use-async-options";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useState } from "react";

import { FormSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";

interface EntityRelationsFieldsProps {
	formId?: string;
	initialRelatedEntityIds?: Array<string>;
	initialRelatedEntityItems: Array<AsyncOption>;
	initialRelatedEntityTotal: number;
	initialRelatedResourceIds?: Array<string>;
	initialRelatedResourceItems: Array<AsyncOption>;
	initialRelatedResourceTotal: number;
	selectedRelatedEntities?: Array<AsyncOption>;
	selectedRelatedResources?: Array<AsyncOption>;
}

async function fetchRelationOptionsPage(
	resource: "entities" | "resources",
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/relations/${resource}?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to load ${resource}.`);
	}

	return (await response.json()) as { items: Array<AsyncOption>; total: number };
}

export function EntityRelationsFields(props: Readonly<EntityRelationsFieldsProps>): ReactNode {
	const {
		formId,
		initialRelatedEntityIds,
		initialRelatedEntityItems,
		initialRelatedEntityTotal,
		initialRelatedResourceIds,
		initialRelatedResourceItems,
		initialRelatedResourceTotal,
		selectedRelatedEntities,
		selectedRelatedResources,
	} = props;

	const t = useExtracted();

	const [selectedEntityIds, setSelectedEntityIds] = useState<Array<string>>(
		() => initialRelatedEntityIds ?? selectedRelatedEntities?.map((item) => item.id) ?? [],
	);
	const [selectedResourceIds, setSelectedResourceIds] = useState<Array<string>>(
		() => initialRelatedResourceIds ?? selectedRelatedResources?.map((item) => item.id) ?? [],
	);

	return (
		<Fragment>
			<FormSection
				description={t("Link related entities to display on the website.")}
				title={t("Related entities")}
			>
				<AsyncListSelect
					addLabel={t("Add related entity")}
					aria-label={t("Related entities")}
					emptyMessage={t("No related entities found.")}
					emptySelectionMessage={t("No related entities")}
					fetchPage={(params) => fetchRelationOptionsPage("entities", params)}
					initialItems={initialRelatedEntityItems}
					initialTotal={initialRelatedEntityTotal}
					isOrderable={true}
					onChange={(ids) => {
						setSelectedEntityIds(ids);
					}}
					selectedItems={selectedRelatedEntities}
					value={selectedEntityIds}
				/>
				{selectedEntityIds.map((entityId, index) => (
					<input
						key={entityId}
						form={formId}
						name={`relatedEntityIds.${String(index)}`}
						type="hidden"
						value={entityId}
					/>
				))}
			</FormSection>

			<Separator className="my-6" />

			<FormSection
				description={t("Link related resources to display on the website.")}
				title={t("Related resources")}
			>
				<AsyncListSelect
					addLabel={t("Add related resource")}
					aria-label={t("Related resources")}
					emptyMessage={t("No related resources found.")}
					emptySelectionMessage={t("No related resources")}
					fetchPage={(params) => fetchRelationOptionsPage("resources", params)}
					initialItems={initialRelatedResourceItems}
					initialTotal={initialRelatedResourceTotal}
					isOrderable={true}
					onChange={(ids) => {
						setSelectedResourceIds(ids);
					}}
					selectedItems={selectedRelatedResources}
					value={selectedResourceIds}
				/>
				{selectedResourceIds.map((resourceId, index) => (
					<input
						key={resourceId}
						form={formId}
						name={`relatedResourceIds.${String(index)}`}
						type="hidden"
						value={resourceId}
					/>
				))}
			</FormSection>
		</Fragment>
	);
}
