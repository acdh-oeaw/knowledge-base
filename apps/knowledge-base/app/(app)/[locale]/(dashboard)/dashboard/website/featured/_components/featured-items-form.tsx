"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { AsyncListSelect } from "@dariah-eric/ui/async-list-select";
import { Button } from "@dariah-eric/ui/button";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import type { AsyncOptionsFetchPageParams } from "@dariah-eric/ui/use-async-options";
import { useExtracted } from "next-intl";
import { type ReactNode, useActionState, useState } from "react";

import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { updateFeaturedItemsAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/featured/_lib/update-featured-items.action";
import type { AnnouncementOption } from "@/lib/data/announcements";
import type { EventOption } from "@/lib/data/events";

const MAX_ALLOWED_FEATURED_ITEMS = 3;

type Option = AnnouncementOption | EventOption;

/** Builds a page fetcher for one of the featured-options endpoints (announcements / events). */
function createFetchOptionsPage(endpoint: string) {
	return async function fetchOptionsPage(
		params: Readonly<AsyncOptionsFetchPageParams>,
	): Promise<{ items: Array<Option>; total: number }> {
		const searchParams = new URLSearchParams({
			limit: String(params.limit),
			offset: String(params.offset),
		});

		if (params.q !== "") {
			searchParams.set("q", params.q);
		}

		const response = await fetch(`${endpoint}?${searchParams.toString()}`, {
			signal: params.signal,
		});

		if (!response.ok) {
			throw new Error("Failed to load options.");
		}

		return (await response.json()) as { items: Array<Option>; total: number };
	};
}

const fetchAnnouncementsPage = createFetchOptionsPage("/api/announcements/options");
const fetchEventsPage = createFetchOptionsPage("/api/events/options");

interface FeaturedItemsFormProps {
	initialFeaturedNewsOptions: { items: Array<AnnouncementOption>; total: number };
	initialFeaturedEventOptions: { items: Array<EventOption>; total: number };
	/** The currently-featured announcements, resolved by id and ordered, for labelling the selection. */
	selectedFeaturedNews: Array<AnnouncementOption>;
	/** The currently-featured events, resolved by id and ordered, for labelling the selection. */
	selectedFeaturedEvents: Array<EventOption>;
	featuredNewsIds: Array<string>;
	featuredEventIds: Array<string>;
}

export function FeaturedItemsForm(props: Readonly<FeaturedItemsFormProps>): ReactNode {
	const {
		initialFeaturedNewsOptions,
		initialFeaturedEventOptions,
		selectedFeaturedNews,
		selectedFeaturedEvents,
	} = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(
		updateFeaturedItemsAction,
		createActionStateInitial(),
	);

	const [featuredNewsIds, setFeaturedNewsIds] = useState<Array<string>>(
		() => props.featuredNewsIds,
	);
	const [featuredEventIds, setFeaturedEventIds] = useState<Array<string>>(
		() => props.featuredEventIds,
	);

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection
					description={t("Featured news items on the landing page. Drag to reorder.")}
					title={t("Featured news items")}
				>
					<AsyncListSelect
						addLabel={t("Add news item")}
						aria-label={t("Featured news items")}
						emptySelectionMessage={t("No featured items yet.")}
						fetchPage={fetchAnnouncementsPage}
						initialItems={initialFeaturedNewsOptions.items}
						initialTotal={initialFeaturedNewsOptions.total}
						isOrderable={true}
						maxItems={MAX_ALLOWED_FEATURED_ITEMS}
						onChange={setFeaturedNewsIds}
						selectedItems={selectedFeaturedNews}
						value={featuredNewsIds}
					/>
					{featuredNewsIds.map((id, index) => (
						<input key={id} name={`featuredNewsIds.${String(index)}`} type="hidden" value={id} />
					))}
				</FormSection>

				<FormSection
					description={t("Featured Events on the landing page. Drag to reorder.")}
					title={t("Featured Events")}
				>
					<AsyncListSelect
						addLabel={t("Add event")}
						aria-label={t("Featured events")}
						emptySelectionMessage={t("No featured events yet.")}
						fetchPage={fetchEventsPage}
						initialItems={initialFeaturedEventOptions.items}
						initialTotal={initialFeaturedEventOptions.total}
						isOrderable={true}
						maxItems={MAX_ALLOWED_FEATURED_ITEMS}
						onChange={setFeaturedEventIds}
						selectedItems={selectedFeaturedEvents}
						value={featuredEventIds}
					/>
					{featuredEventIds.map((id, index) => (
						<input key={id} name={`featuredEventIds.${String(index)}`} type="hidden" value={id} />
					))}
				</FormSection>

				<div className="flex items-center justify-end gap-x-3">
					<FormStatus className="text-sm" state={state} />

					<Button isPending={isPending} type="submit">
						{isPending ? <span aria-hidden={true}>{t("Saving...")}</span> : t("Save")}
					</Button>
				</div>
			</Form>
		</FormLayout>
	);
}
