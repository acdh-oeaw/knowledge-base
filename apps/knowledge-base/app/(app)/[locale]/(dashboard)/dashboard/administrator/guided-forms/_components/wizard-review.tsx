"use client";

import { Badge } from "@dariah-eric/ui/badge";
import { useExtracted, useFormatter } from "next-intl";
import type { ReactNode } from "react";

import { FormSectionTitle } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import type {
	WizardPlanItem,
	WizardPlanItemStatus,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/wizard-plan";

/**
 * The "here is exactly what will be written" step every guided form ends on. Nothing is saved until
 * the admin submits from here, so this list is the whole point of the feature: the relations that
 * are easy to forget are stated explicitly, alongside the ones that already exist and will be left
 * alone.
 *
 * Relation and role names are shown in the vocabulary of the data model (`is_located_in`), not
 * translated — the same choice the maintenance dashboard makes, so admins can match what they read
 * here against the relation tables and the integrity findings.
 */

function formatRelationType(type: string): string {
	return type.replaceAll("_", " ");
}

interface WizardReviewProps {
	items: ReadonlyArray<WizardPlanItem>;
}

export function WizardReview(props: Readonly<WizardReviewProps>): ReactNode {
	const { items } = props;

	const t = useExtracted();

	return (
		<section className="space-y-3">
			<FormSectionTitle title={t("Review")} />

			{items.length > 0 ? (
				<ul className="divide-y divide-border rounded-lg border border-border">
					{items.map((item) => (
						<li key={item.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 p-3">
							<WizardPlanItemStatusBadge status={item.status} />
							<WizardPlanItemStatement item={item} />
						</li>
					))}
				</ul>
			) : (
				<p className="text-sm text-muted-fg">{t("Nothing to save yet.")}</p>
			)}
		</section>
	);
}

function WizardPlanItemStatusBadge(props: Readonly<{ status: WizardPlanItemStatus }>): ReactNode {
	const { status } = props;

	const t = useExtracted();

	switch (status) {
		case "create": {
			return <Badge intent="emerald">{t("Will create")}</Badge>;
		}
		case "update": {
			return <Badge intent="amber">{t("Will update")}</Badge>;
		}
		case "skip": {
			return <Badge intent="slate">{t("Already recorded")}</Badge>;
		}
	}
}

function WizardPlanItemStatement(props: Readonly<{ item: WizardPlanItem }>): ReactNode {
	const { item } = props;

	const t = useExtracted();

	switch (item.kind) {
		case "entity": {
			const label = item.entityType === "institution" ? t("Institution") : t("Person");

			return (
				<span className="text-sm">
					<span className="text-muted-fg">{label}</span>
					{" · "}
					<span className="font-medium">{item.name}</span>
					{" · "}
					<span className="text-muted-fg">
						{item.lifecycle === "published" ? t("published") : t("draft")}
					</span>
				</span>
			);
		}
		case "unit_relation": {
			return (
				<span className="text-sm">
					<span className="font-medium">{item.unitName}</span>
					{" · "}
					<span className="text-muted-fg">{formatRelationType(item.relationType)}</span>
					{" · "}
					<span className="font-medium">{item.relatedUnitName}</span>
					{" · "}
					<WizardPeriod end={item.end} start={item.start} />
				</span>
			);
		}
		case "person_relation": {
			return (
				<span className="text-sm">
					<span className="font-medium">{item.personName}</span>
					{" · "}
					<span className="text-muted-fg">{formatRelationType(item.roleType)}</span>
					{" · "}
					<span className="font-medium">{item.unitName}</span>
					{" · "}
					<WizardPeriod end={item.end} start={item.start} />
				</span>
			);
		}
	}
}

export function WizardPeriod(props: Readonly<{ start: string; end: string | null }>): ReactNode {
	const { start, end } = props;

	const t = useExtracted();
	const format = useFormatter();

	const formatted =
		end != null
			? format.dateTimeRange(new Date(start), new Date(end), { dateStyle: "short" })
			: `${format.dateTime(new Date(start), { dateStyle: "short" })} - ${t("present")}`;

	return <span className="text-muted-fg">{formatted}</span>;
}
