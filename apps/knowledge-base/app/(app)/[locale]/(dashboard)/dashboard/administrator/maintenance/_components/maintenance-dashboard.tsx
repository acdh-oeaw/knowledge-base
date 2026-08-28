"use client";

import { Tab, TabList, TabPanel, Tabs } from "@dariah-eric/ui/tabs";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useState } from "react";
import type { Key } from "react-aria-components";

import { EntityListHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import { DuplicateEntity } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/duplicate-entity";
import { MergeEntities } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/merge-entities";
import { MergeServices } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/merge-services";
import { MergeSocialMedia } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/merge-social-media";
import { SlugEditor } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/slug-editor";

interface MaintenanceDashboardProps {
	countryMembership: ReactNode;
	emptyContentBlocks: ReactNode;
	headingHierarchy: ReactNode;
	inactiveUnitRelations: ReactNode;
	mutuallyExclusiveRelations: ReactNode;
	pairedRelations: ReactNode;
	richText: ReactNode;
	unitRelationRequirements: ReactNode;
	unusedAssets: ReactNode;
	unusedSocialMedia: ReactNode;
	webAddresses: ReactNode;
}

export function MaintenanceDashboard(props: Readonly<MaintenanceDashboardProps>): ReactNode {
	const {
		countryMembership,
		emptyContentBlocks,
		headingHierarchy,
		inactiveUnitRelations,
		mutuallyExclusiveRelations,
		pairedRelations,
		richText,
		unitRelationRequirements,
		unusedAssets,
		unusedSocialMedia,
		webAddresses,
	} = props;

	const t = useExtracted();
	const [selectedTab, setSelectedTab] = useState<Key>("integrity");

	return (
		<Fragment>
			<EntityListHeader
				title={t("Maintenance")}
				description={t("Data-integrity checks and cleanup actions for administrators.")}
			/>

			<Tabs onSelectionChange={setSelectedTab} selectedKey={selectedTab}>
				<TabList aria-label={t("Maintenance")}>
					<Tab id="integrity">{t("Data integrity")}</Tab>
					<Tab id="cleanup">{t("Cleanup")}</Tab>
					<Tab id="merge">{t("Merge, duplicate & rename")}</Tab>
				</TabList>

				<TabPanel id="integrity">
					<Tabs>
						<TabList aria-label={t("Data-integrity checks")}>
							<Tab id="paired-relations">{t("Paired relations")}</Tab>
							<Tab id="unit-relation-requirements">{t("Required relations")}</Tab>
							<Tab id="mutually-exclusive-relations">{t("Conflicting relations")}</Tab>
							<Tab id="country-membership">{t("Country membership")}</Tab>
							<Tab id="inactive-unit-relations">{t("Inactive units")}</Tab>
							<Tab id="web-addresses">{t("Web addresses")}</Tab>
						</TabList>

						<TabPanel id="paired-relations" className="flex flex-col gap-y-(--layout-padding)">
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Pairs of relations which must always be recorded together, e.g. a national representative must also be a member of the General Assembly, and a national coordinator must also be a member of the National Coordinator Committee, for the same period.",
								)}
							</p>

							{pairedRelations}
						</TabPanel>

						<TabPanel
							id="unit-relation-requirements"
							className="flex flex-col gap-y-(--layout-padding)"
						>
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Organisational units whose relations imply another that is missing, e.g. every institution that is a partner institution or cooperating partner of DARIAH-EU must also record which country it is located in.",
								)}
							</p>

							{unitRelationRequirements}
						</TabPanel>

						<TabPanel
							id="mutually-exclusive-relations"
							className="flex flex-col gap-y-(--layout-padding)"
						>
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Institutions whose relations to DARIAH-EU cannot both hold at once. A national coordinating institution is by definition a partner institution, so the partner relation is redundant and should be removed; a cooperating partner, by contrast, contradicts the full partner statuses, so one of the two is simply wrong. Flagged only where the periods overlap — an institution that held one status before the other is valid history.",
								)}
							</p>

							{mutuallyExclusiveRelations}
						</TabPanel>

						<TabPanel id="country-membership" className="flex flex-col gap-y-(--layout-padding)">
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Institutions whose status with DARIAH-EU does not match the country they are located in. A partner, national coordinating, or national representative institution must sit in a country that is a member or observer of DARIAH-EU for the whole period it holds that status; a cooperating partner must sit in one that is neither.",
								)}
							</p>

							{countryMembership}
						</TabPanel>

						<TabPanel
							id="inactive-unit-relations"
							className="flex flex-col gap-y-(--layout-padding)"
						>
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Organisational units that are no longer active but still have open person relations, e.g. a working group whose membership in an ERIC has ended, or a country that is no longer a member, but whose chair, member, coordinator, representative, or contact relations have no end date.",
								)}
							</p>

							{inactiveUnitRelations}
						</TabPanel>

						<TabPanel id="web-addresses" className="flex flex-col gap-y-(--layout-padding)">
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Records whose stored web address is not a valid https URL: a missing or non-https scheme, or a value that does not parse. Covers event and opportunity websites, document and policy links, license URLs, social-media links, embed blocks, and working-group report events. A social-media entry may also be an email address. Reported only — the correct address needs an editor.",
								)}
							</p>

							{webAddresses}
						</TabPanel>
					</Tabs>
				</TabPanel>

				<TabPanel id="cleanup">
					<Tabs>
						<TabList aria-label={t("Cleanup tasks")}>
							<Tab id="unused-assets">{t("Unused assets")}</Tab>
							<Tab id="empty-content-blocks">{t("Empty content blocks")}</Tab>
							<Tab id="unused-social-media">{t("Unused social media")}</Tab>
							<Tab id="richtext">{t("Rich-text normalisation")}</Tab>
							<Tab id="heading-hierarchy">{t("Heading hierarchy")}</Tab>
						</TabList>

						<TabPanel id="unused-assets" className="flex flex-col gap-y-(--layout-padding)">
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Assets (images) which are not referenced by any record or embedded in any rich-text field. Review and select the ones to permanently remove from storage and the database.",
								)}
							</p>

							{unusedAssets}
						</TabPanel>

						<TabPanel id="empty-content-blocks" className="flex flex-col gap-y-(--layout-padding)">
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Rich-text content blocks with no meaningful content (empty paragraphs, stray line breaks). Review and select the ones to remove from their entities.",
								)}
							</p>

							{emptyContentBlocks}
						</TabPanel>

						<TabPanel id="unused-social-media" className="flex flex-col gap-y-(--layout-padding)">
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Social-media entries not linked to any project, organisational unit, service, or report. Review and select the ones to permanently remove from the database.",
								)}
							</p>

							{unusedSocialMedia}
						</TabPanel>

						<TabPanel id="richtext" className="flex flex-col gap-y-(--layout-padding)">
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Content blocks whose rich text can be tidied: empty paragraphs, stray line breaks, non-breaking spaces, imported HTML attributes, and bold headings. Review and select the ones to rewrite.",
								)}
							</p>

							{richText}
						</TabPanel>

						<TabPanel id="heading-hierarchy" className="flex flex-col gap-y-(--layout-padding)">
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Rich-text fields whose headings do not form a proper outline. Every field should open at a level-2 heading (the page title is the only level-1), and levels must not be skipped on the way down — a level-2 heading may be followed by a level-3, but not straight by a level-4. Unlike the normalisation above, these are reported only: the right level cannot be guessed automatically and needs an editor to correct.",
								)}
							</p>

							{headingHierarchy}
						</TabPanel>
					</Tabs>
				</TabPanel>

				<TabPanel id="merge">
					<Tabs>
						<TabList aria-label={t("Merge, duplicate & rename")}>
							<Tab id="merge-entities">{t("Merge duplicates")}</Tab>
							<Tab id="merge-social-media">{t("Merge social media")}</Tab>
							<Tab id="merge-services">{t("Merge services")}</Tab>
							<Tab id="duplicate-entity">{t("Duplicate entity")}</Tab>
							<Tab id="edit-slug">{t("Edit slug")}</Tab>
						</TabList>

						<TabPanel id="merge-entities" className="flex flex-col gap-y-(--layout-padding)">
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Merge a duplicate entity into a canonical one: all relations are re-pointed onto the target and the source is permanently deleted. Both entities must be the same type.",
								)}
							</p>

							<MergeEntities />
						</TabPanel>

						<TabPanel id="merge-social-media" className="flex flex-col gap-y-(--layout-padding)">
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Merge a duplicate social-media account into a canonical one: every link from organisational units, projects, services, and reports is re-pointed onto the target and the source is permanently deleted. Use it to make sure a single account is the one everything points at, then clear out what is left via Unused social media.",
								)}
							</p>

							<MergeSocialMedia />
						</TabPanel>

						<TabPanel id="merge-services" className="flex flex-col gap-y-(--layout-padding)">
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Merge a duplicate service into a canonical one: consortium roles, social-media links, and every country report that lists the service or reports KPIs against it are re-pointed onto the target, and the source is permanently deleted. Use it to retire a service the SSHOC marketplace no longer lists — deleting one outright discards the reporting history attached to it, whereas merging carries that history over.",
								)}
							</p>

							<MergeServices />
						</TabPanel>

						<TabPanel id="duplicate-entity" className="flex flex-col gap-y-(--layout-padding)">
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Copy an entity — content and relations, but no reporting data — into a new unpublished draft. Use it to split an imported “Institution A and Institution B” record into two, or to succeed a wound-up working group with a fresh entity instead of reopening the old one.",
								)}
							</p>

							<DuplicateEntity />
						</TabPanel>

						<TabPanel id="edit-slug" className="flex flex-col gap-y-(--layout-padding)">
							<p className="text-sm text-balance text-muted-fg">
								{t(
									"Change an entity's slug. This is an administrator-only maintenance action — slugs are normally managed by the system and form part of the public URL.",
								)}
							</p>

							<SlugEditor />
						</TabPanel>
					</Tabs>
				</TabPanel>
			</Tabs>
		</Fragment>
	);
}
