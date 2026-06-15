import { defineRelations } from "drizzle-orm";
import { type RelationsFilter, relationsFilterToSQL } from "drizzle-orm/relations";

import * as schema from "./schema";

export { type RelationsFilter, relationsFilterToSQL };

export const relations = defineRelations(schema, (r) => {
	return {
		auditLogs: {
			actor: r.one.users({
				from: r.auditLogs.actorUserId,
				to: r.users.id,
				optional: true,
			}),
		},
		assets: {
			license: r.one.licenses({
				from: r.assets.licenseId,
				to: r.licenses.id,
			}),
		},
		documentPolicyGroups: {
			documentsPolicies: r.many.documentsPolicies({
				from: r.documentPolicyGroups.id,
				to: r.documentsPolicies.groupId,
			}),
		},
		documentationPages: {
			entityVersion: r.one.entityVersions({
				from: r.documentationPages.id,
				to: r.entityVersions.id,
				optional: false,
			}),
		},
		internalPages: {
			entityVersion: r.one.entityVersions({
				from: r.internalPages.id,
				to: r.entityVersions.id,
				optional: false,
			}),
		},
		documentsPolicies: {
			entityVersion: r.one.entityVersions({
				from: r.documentsPolicies.id,
				to: r.entityVersions.id,
				optional: false,
			}),
			document: r.one.assets({
				from: r.documentsPolicies.documentId,
				to: r.assets.id,
				optional: false,
			}),
			group: r.one.documentPolicyGroups({
				from: r.documentsPolicies.groupId,
				to: r.documentPolicyGroups.id,
				optional: true,
			}),
		},
		contentBlocks: {
			field: r.one.fields({
				from: r.contentBlocks.fieldId,
				to: r.fields.id,
				optional: false,
			}),
			type: r.one.contentBlockTypes({
				from: r.contentBlocks.typeId,
				to: r.contentBlockTypes.id,
				optional: false,
			}),
			dataContentBlock: r.one.dataContentBlocks({
				from: r.contentBlocks.id,
				to: r.dataContentBlocks.id,
				optional: true,
			}),
			embedContentBlock: r.one.embedContentBlocks({
				from: r.contentBlocks.id,
				to: r.embedContentBlocks.id,
				optional: true,
			}),
			galleryContentBlock: r.one.galleryContentBlocks({
				from: r.contentBlocks.id,
				to: r.galleryContentBlocks.id,
				optional: true,
			}),
			imageContentBlock: r.one.imageContentBlocks({
				from: r.contentBlocks.id,
				to: r.imageContentBlocks.id,
				optional: true,
			}),
			richTextContentBlock: r.one.richTextContentBlocks({
				from: r.contentBlocks.id,
				to: r.richTextContentBlocks.id,
				optional: true,
			}),
			heroContentBlock: r.one.heroContentBlocks({
				from: r.contentBlocks.id,
				to: r.heroContentBlocks.id,
				optional: true,
			}),
			accordionContentBlock: r.one.accordionContentBlocks({
				from: r.contentBlocks.id,
				to: r.accordionContentBlocks.id,
				optional: true,
			}),
		},
		dataContentBlocks: {
			contentBlock: r.one.contentBlocks({
				from: r.dataContentBlocks.id,
				to: r.contentBlocks.id,
				optional: false,
			}),
			type: r.one.dataContentBlockTypes({
				from: r.dataContentBlocks.typeId,
				to: r.dataContentBlockTypes.id,
				optional: false,
			}),
		},
		embedContentBlocks: {
			contentBlock: r.one.contentBlocks({
				from: r.embedContentBlocks.id,
				to: r.contentBlocks.id,
				optional: false,
			}),
		},
		galleryContentBlocks: {
			contentBlock: r.one.contentBlocks({
				from: r.galleryContentBlocks.id,
				to: r.contentBlocks.id,
				optional: false,
			}),
			items: r.many.galleryContentBlockItems({
				from: r.galleryContentBlocks.id,
				to: r.galleryContentBlockItems.galleryContentBlockId,
			}),
		},
		galleryContentBlockItems: {
			galleryContentBlock: r.one.galleryContentBlocks({
				from: r.galleryContentBlockItems.galleryContentBlockId,
				to: r.galleryContentBlocks.id,
				optional: false,
			}),
			image: r.one.assets({
				from: r.galleryContentBlockItems.imageId,
				to: r.assets.id,
				optional: false,
			}),
		},
		entities: {
			type: r.one.entityTypes({
				from: r.entities.typeId,
				to: r.entityTypes.id,
				optional: false,
			}),
			versions: r.many.entityVersions({
				from: r.entities.id,
				to: r.entityVersions.entityId,
			}),
			lifecycle: r.one.documentLifecycle({
				from: r.entities.id,
				to: r.documentLifecycle.documentId,
			}),
			relatedEntities: r.many.entities({
				from: r.entities.id.through(r.entitiesToEntities.entityId),
				to: r.entities.id.through(r.entitiesToEntities.relatedEntityId),
			}),
		},
		documentLifecycle: {
			entity: r.one.entities({
				from: r.documentLifecycle.documentId,
				to: r.entities.id,
				optional: false,
			}),
		},
		entityVersions: {
			entity: r.one.entities({
				from: r.entityVersions.entityId,
				to: r.entities.id,
				optional: false,
			}),
			status: r.one.entityStatus({
				from: r.entityVersions.statusId,
				to: r.entityStatus.id,
				optional: false,
			}),
			fields: r.many.fields({
				from: r.entityVersions.id,
				to: r.fields.entityVersionId,
			}),
		},
		events: {
			entityVersion: r.one.entityVersions({
				from: r.events.id,
				to: r.entityVersions.id,
				optional: false,
			}),
			image: r.one.assets({
				from: r.events.imageId,
				to: r.assets.id,
				optional: false,
			}),
		},
		entityTypesFieldsNames: {
			entityType: r.one.entityTypes({
				from: r.entityTypesFieldsNames.entityTypeId,
				to: r.entityTypes.id,
			}),
		},
		fields: {
			entityVersion: r.one.entityVersions({
				from: r.fields.entityVersionId,
				to: r.entityVersions.id,
				optional: false,
			}),
			name: r.one.entityTypesFieldsNames({
				from: r.fields.fieldNameId,
				to: r.entityTypesFieldsNames.id,
				optional: false,
			}),
			contentBlocks: r.many.contentBlocks({
				from: r.fields.id,
				to: r.contentBlocks.fieldId,
			}),
		},
		imageContentBlocks: {
			contentBlock: r.one.contentBlocks({
				from: r.imageContentBlocks.id,
				to: r.contentBlocks.id,
				optional: false,
			}),
			image: r.one.assets({
				from: r.imageContentBlocks.imageId,
				to: r.assets.id,
				optional: false,
			}),
		},
		impactCaseStudies: {
			contributors: r.many.persons({
				from: r.impactCaseStudies.id.through(
					r.impactCaseStudiesToPersons.impactCaseStudyDocumentId,
				),
				to: r.persons.id.through(r.impactCaseStudiesToPersons.personDocumentId),
			}),
			entityVersion: r.one.entityVersions({
				from: r.impactCaseStudies.id,
				to: r.entityVersions.id,
				optional: false,
			}),
			image: r.one.assets({
				from: r.impactCaseStudies.imageId,
				to: r.assets.id,
				optional: false,
			}),
		},
		dariahProjects: {
			entityVersion: r.one.entityVersions({
				from: r.dariahProjects.id,
				to: r.entityVersions.id,
				optional: false,
			}),
			image: r.one.assets({
				from: r.dariahProjects.imageId,
				to: r.assets.id,
			}),
			projectsToOrganisationalUnits: r.many.projectsToOrganisationalUnits({
				from: r.dariahProjects.id,
				to: r.projectsToOrganisationalUnits.projectDocumentId,
			}),
			scope: r.one.projectScopes({
				from: r.dariahProjects.scopeId,
				to: r.projectScopes.id,
				optional: false,
			}),
			socialMedia: r.many.socialMedia({
				from: r.dariahProjects.id.through(r.projectsToSocialMedia.projectId),
				to: r.socialMedia.id.through(r.projectsToSocialMedia.socialMediaId),
			}),
		},
		fundingCalls: {
			entityVersion: r.one.entityVersions({
				from: r.fundingCalls.id,
				to: r.entityVersions.id,
				optional: false,
			}),
		},
		membersAndPartners: {
			image: r.one.assets({
				from: r.membersAndPartners.imageId,
				to: r.assets.id,
			}),
			entityVersion: r.one.entityVersions({
				from: r.membersAndPartners.id,
				to: r.entityVersions.id,
				optional: false,
			}),
			socialMedia: r.many.socialMedia({
				from: r.membersAndPartners.id.through(
					r.organisationalUnitsToSocialMedia.organisationalUnitId,
				),
				to: r.socialMedia.id.through(r.organisationalUnitsToSocialMedia.socialMediaId),
			}),
		},
		opportunities: {
			entityVersion: r.one.entityVersions({
				from: r.opportunities.id,
				to: r.entityVersions.id,
				optional: false,
			}),
			source: r.one.opportunitySources({
				from: r.opportunities.sourceId,
				to: r.opportunitySources.id,
				optional: false,
			}),
		},
		workingGroups: {
			image: r.one.assets({
				from: r.workingGroups.imageId,
				to: r.assets.id,
			}),
			entityVersion: r.one.entityVersions({
				from: r.workingGroups.id,
				to: r.entityVersions.id,
				optional: false,
			}),
			socialMedia: r.many.socialMedia({
				from: r.workingGroups.id.through(r.organisationalUnitsToSocialMedia.organisationalUnitId),
				to: r.socialMedia.id.through(r.organisationalUnitsToSocialMedia.socialMediaId),
			}),
		},
		news: {
			entityVersion: r.one.entityVersions({
				from: r.news.id,
				to: r.entityVersions.id,
				optional: false,
			}),
			image: r.one.assets({
				from: r.news.imageId,
				to: r.assets.id,
				optional: false,
			}),
		},
		organisationalUnits: {
			image: r.one.assets({
				from: r.organisationalUnits.imageId,
				to: r.assets.id,
			}),
			entityVersion: r.one.entityVersions({
				from: r.organisationalUnits.id,
				to: r.entityVersions.id,
				optional: false,
			}),
			organisationalUnits: r.many.organisationalUnits({
				from: r.organisationalUnits.id.through(r.organisationalUnitsRelations.unitDocumentId),
				to: r.organisationalUnits.id.through(r.organisationalUnitsRelations.relatedUnitDocumentId),
			}),
			socialMedia: r.many.socialMedia({
				from: r.organisationalUnits.id.through(
					r.organisationalUnitsToSocialMedia.organisationalUnitId,
				),
				to: r.socialMedia.id.through(r.organisationalUnitsToSocialMedia.socialMediaId),
			}),
			type: r.one.organisationalUnitTypes({
				from: r.organisationalUnits.typeId,
				to: r.organisationalUnitTypes.id,
				optional: false,
			}),
			services: r.many.services({
				from: r.organisationalUnits.id.through(
					r.servicesToOrganisationalUnits.organisationalUnitDocumentId,
				),
				to: r.services.id.through(r.servicesToOrganisationalUnits.serviceId),
			}),
		},
		projects: {
			entityVersion: r.one.entityVersions({
				from: r.projects.id,
				to: r.entityVersions.id,
				optional: false,
			}),
			image: r.one.assets({
				from: r.projects.imageId,
				to: r.assets.id,
			}),
			organisationalUnits: r.many.organisationalUnits({
				from: r.projects.id.through(r.projectsToOrganisationalUnits.projectDocumentId),
				to: r.organisationalUnits.id.through(r.projectsToOrganisationalUnits.unitDocumentId),
			}),
			scope: r.one.projectScopes({
				from: r.projects.scopeId,
				to: r.projectScopes.id,
				optional: false,
			}),
			socialMedia: r.many.socialMedia({
				from: r.projects.id.through(r.projectsToSocialMedia.projectId),
				to: r.socialMedia.id.through(r.projectsToSocialMedia.socialMediaId),
			}),
			projectsToOrganisationalUnits: r.many.projectsToOrganisationalUnits({
				from: r.projects.id,
				to: r.projectsToOrganisationalUnits.projectDocumentId,
			}),
		},
		projectsToOrganisationalUnits: {
			projectEntity: r.one.entities({
				from: r.projectsToOrganisationalUnits.projectDocumentId,
				to: r.entities.id,
				optional: false,
			}),
			unitEntity: r.one.entities({
				from: r.projectsToOrganisationalUnits.unitDocumentId,
				to: r.entities.id,
				optional: false,
			}),
			role: r.one.projectRoles({
				from: r.projectsToOrganisationalUnits.roleId,
				to: r.projectRoles.id,
				optional: false,
			}),
		},
		pages: {
			entityVersion: r.one.entityVersions({
				from: r.pages.id,
				to: r.entityVersions.id,
				optional: false,
			}),
			image: r.one.assets({
				from: r.pages.imageId,
				to: r.assets.id,
			}),
		},
		persons: {
			entityVersion: r.one.entityVersions({
				from: r.persons.id,
				to: r.entityVersions.id,
				optional: false,
			}),
			image: r.one.assets({
				from: r.persons.imageId,
				to: r.assets.id,
			}),
		},
		personsToOrganisationalUnits: {
			personEntity: r.one.entities({
				from: r.personsToOrganisationalUnits.personDocumentId,
				to: r.entities.id,
				optional: false,
			}),
			organisationalUnitEntity: r.one.entities({
				from: r.personsToOrganisationalUnits.organisationalUnitDocumentId,
				to: r.entities.id,
				optional: false,
			}),
			roleType: r.one.personRoleTypes({
				from: r.personsToOrganisationalUnits.roleTypeId,
				to: r.personRoleTypes.id,
				optional: false,
			}),
			contributions: r.many.countryReportContributions({
				from: r.personsToOrganisationalUnits.id,
				to: r.countryReportContributions.personToOrgUnitId,
			}),
		},
		richTextContentBlocks: {
			contentBlock: r.one.contentBlocks({
				from: r.richTextContentBlocks.id,
				to: r.contentBlocks.id,
				optional: false,
			}),
		},
		heroContentBlocks: {
			contentBlock: r.one.contentBlocks({
				from: r.heroContentBlocks.id,
				to: r.contentBlocks.id,
				optional: false,
			}),
			image: r.one.assets({
				from: r.heroContentBlocks.imageId,
				to: r.assets.id,
				optional: true,
			}),
		},
		accordionContentBlocks: {
			contentBlock: r.one.contentBlocks({
				from: r.accordionContentBlocks.id,
				to: r.contentBlocks.id,
				optional: false,
			}),
		},
		services: {
			type: r.one.serviceTypes({
				from: r.services.typeId,
				to: r.serviceTypes.id,
				optional: false,
			}),
			status: r.one.serviceStatuses({
				from: r.services.statusId,
				to: r.serviceStatuses.id,
				optional: false,
			}),
			organisationalUnits: r.many.organisationalUnits({
				from: r.services.id.through(r.servicesToOrganisationalUnits.serviceId),
				to: r.organisationalUnits.id.through(
					r.servicesToOrganisationalUnits.organisationalUnitDocumentId,
				),
			}),
			socialMedia: r.many.socialMedia({
				from: r.services.id.through(r.servicesToSocialMedia.serviceId),
				to: r.socialMedia.id.through(r.servicesToSocialMedia.socialMediaId),
			}),
		},
		servicesToOrganisationalUnits: {
			service: r.one.services({
				from: r.servicesToOrganisationalUnits.serviceId,
				to: r.services.id,
				optional: false,
			}),
			organisationalUnitEntity: r.one.entities({
				from: r.servicesToOrganisationalUnits.organisationalUnitDocumentId,
				to: r.entities.id,
				optional: false,
			}),
			role: r.one.organisationalUnitServiceRoles({
				from: r.servicesToOrganisationalUnits.roleId,
				to: r.organisationalUnitServiceRoles.id,
				optional: false,
			}),
		},
		servicesToSocialMedia: {
			service: r.one.services({
				from: r.servicesToSocialMedia.serviceId,
				to: r.services.id,
				optional: false,
			}),
			socialMedia: r.one.socialMedia({
				from: r.servicesToSocialMedia.socialMediaId,
				to: r.socialMedia.id,
				optional: false,
			}),
		},
		socialMedia: {
			type: r.one.socialMediaTypes({
				from: r.socialMedia.typeId,
				to: r.socialMediaTypes.id,
				optional: false,
			}),
			organisationalUnits: r.many.organisationalUnits({
				from: r.socialMedia.id.through(r.organisationalUnitsToSocialMedia.socialMediaId),
				to: r.organisationalUnits.id.through(
					r.organisationalUnitsToSocialMedia.organisationalUnitId,
				),
			}),
			projects: r.many.projects({
				from: r.socialMedia.id.through(r.projectsToSocialMedia.socialMediaId),
				to: r.projects.id.through(r.projectsToSocialMedia.projectId),
			}),
			services: r.many.services({
				from: r.socialMedia.id.through(r.servicesToSocialMedia.socialMediaId),
				to: r.services.id.through(r.servicesToSocialMedia.serviceId),
			}),
		},
		projectsToSocialMedia: {
			project: r.one.projects({
				from: r.projectsToSocialMedia.projectId,
				to: r.projects.id,
				optional: false,
			}),
			socialMedia: r.one.socialMedia({
				from: r.projectsToSocialMedia.socialMediaId,
				to: r.socialMedia.id,
				optional: false,
			}),
		},
		organisationalUnitsToSocialMedia: {
			organisationalUnit: r.one.organisationalUnits({
				from: r.organisationalUnitsToSocialMedia.organisationalUnitId,
				to: r.organisationalUnits.id,
				optional: false,
			}),
			socialMedia: r.one.socialMedia({
				from: r.organisationalUnitsToSocialMedia.socialMediaId,
				to: r.socialMedia.id,
				optional: false,
			}),
		},
		siteMetadata: {
			ogImage: r.one.assets({
				from: r.siteMetadata.ogImageId,
				to: r.assets.id,
				optional: true,
			}),
		},
		users: {
			personEntity: r.one.entities({
				from: r.users.personDocumentId,
				to: r.entities.id,
				optional: true,
			}),
			organisationalUnitEntity: r.one.entities({
				from: r.users.organisationalUnitDocumentId,
				to: r.entities.id,
				optional: true,
			}),
		},
		reportingCampaigns: {
			countryReports: r.many.countryReports({
				from: r.reportingCampaigns.id,
				to: r.countryReports.campaignId,
			}),
			workingGroupReports: r.many.workingGroupReports({
				from: r.reportingCampaigns.id,
				to: r.workingGroupReports.campaignId,
			}),
			workingGroupReportQuestions: r.many.workingGroupReportQuestions({
				from: r.reportingCampaigns.id,
				to: r.workingGroupReportQuestions.campaignId,
			}),
			eventAmounts: r.many.reportingCampaignEventAmounts({
				from: r.reportingCampaigns.id,
				to: r.reportingCampaignEventAmounts.campaignId,
			}),
			socialMediaAmounts: r.many.reportingCampaignSocialMediaAmounts({
				from: r.reportingCampaigns.id,
				to: r.reportingCampaignSocialMediaAmounts.campaignId,
			}),
			contributionAmounts: r.many.reportingCampaignContributionAmounts({
				from: r.reportingCampaigns.id,
				to: r.reportingCampaignContributionAmounts.campaignId,
			}),
			serviceSizes: r.many.reportingCampaignServiceSizes({
				from: r.reportingCampaigns.id,
				to: r.reportingCampaignServiceSizes.campaignId,
			}),
			countryThresholds: r.many.reportingCampaignCountryThresholds({
				from: r.reportingCampaigns.id,
				to: r.reportingCampaignCountryThresholds.campaignId,
			}),
		},
		countryReports: {
			campaign: r.one.reportingCampaigns({
				from: r.countryReports.campaignId,
				to: r.reportingCampaigns.id,
				optional: false,
			}),
			// The report's country is a document id; resolve it to its published org-unit version through
			// the documentLifecycle view so `with: { country }` keeps returning the org unit (nullable).
			country: r.one.organisationalUnits({
				from: r.countryReports.countryDocumentId.through(r.documentLifecycle.documentId),
				to: r.organisationalUnits.id.through(r.documentLifecycle.publishedId),
			}),
			contributions: r.many.countryReportContributions({
				from: r.countryReports.id,
				to: r.countryReportContributions.countryReportId,
			}),
			socialMediaKpis: r.many.countryReportSocialMediaKpis({
				from: r.countryReports.id,
				to: r.countryReportSocialMediaKpis.countryReportId,
			}),
			serviceKpis: r.many.countryReportServiceKpis({
				from: r.countryReports.id,
				to: r.countryReportServiceKpis.countryReportId,
			}),
			projectContributions: r.many.countryReportProjectContributions({
				from: r.countryReports.id,
				to: r.countryReportProjectContributions.countryReportId,
			}),
			institutions: r.many.countryReportInstitutions({
				from: r.countryReports.id,
				to: r.countryReportInstitutions.countryReportId,
			}),
		},
		countryReportContributions: {
			countryReport: r.one.countryReports({
				from: r.countryReportContributions.countryReportId,
				to: r.countryReports.id,
				optional: false,
			}),
			personToOrgUnit: r.one.personsToOrganisationalUnits({
				from: r.countryReportContributions.personToOrgUnitId,
				to: r.personsToOrganisationalUnits.id,
				optional: false,
			}),
		},
		countryReportSocialMediaKpis: {
			countryReport: r.one.countryReports({
				from: r.countryReportSocialMediaKpis.countryReportId,
				to: r.countryReports.id,
				optional: false,
			}),
			socialMedia: r.one.socialMedia({
				from: r.countryReportSocialMediaKpis.socialMediaId,
				to: r.socialMedia.id,
				optional: false,
			}),
		},
		countryReportServiceKpis: {
			countryReport: r.one.countryReports({
				from: r.countryReportServiceKpis.countryReportId,
				to: r.countryReports.id,
				optional: false,
			}),
			service: r.one.services({
				from: r.countryReportServiceKpis.serviceId,
				to: r.services.id,
				optional: false,
			}),
		},
		countryReportProjectContributions: {
			countryReport: r.one.countryReports({
				from: r.countryReportProjectContributions.countryReportId,
				to: r.countryReports.id,
				optional: false,
			}),
			// Resolve the document id to its published project version through the documentLifecycle view (nullable).
			project: r.one.projects({
				from: r.countryReportProjectContributions.projectDocumentId.through(
					r.documentLifecycle.documentId,
				),
				to: r.projects.id.through(r.documentLifecycle.publishedId),
			}),
		},
		countryReportInstitutions: {
			countryReport: r.one.countryReports({
				from: r.countryReportInstitutions.countryReportId,
				to: r.countryReports.id,
				optional: false,
			}),
			// Resolve the document id to its published org-unit version through the documentLifecycle view (nullable).
			organisationalUnit: r.one.organisationalUnits({
				from: r.countryReportInstitutions.organisationalUnitDocumentId.through(
					r.documentLifecycle.documentId,
				),
				to: r.organisationalUnits.id.through(r.documentLifecycle.publishedId),
			}),
		},
		workingGroupReports: {
			campaign: r.one.reportingCampaigns({
				from: r.workingGroupReports.campaignId,
				to: r.reportingCampaigns.id,
				optional: false,
			}),
			// Resolve the document id to its published org-unit version through the documentLifecycle view (nullable).
			workingGroup: r.one.organisationalUnits({
				from: r.workingGroupReports.workingGroupDocumentId.through(r.documentLifecycle.documentId),
				to: r.organisationalUnits.id.through(r.documentLifecycle.publishedId),
			}),
			socialMedia: r.many.workingGroupReportSocialMedia({
				from: r.workingGroupReports.id,
				to: r.workingGroupReportSocialMedia.workingGroupReportId,
			}),
			events: r.many.workingGroupReportEvents({
				from: r.workingGroupReports.id,
				to: r.workingGroupReportEvents.workingGroupReportId,
			}),
			answers: r.many.workingGroupReportAnswers({
				from: r.workingGroupReports.id,
				to: r.workingGroupReportAnswers.workingGroupReportId,
			}),
		},
		workingGroupReportSocialMedia: {
			workingGroupReport: r.one.workingGroupReports({
				from: r.workingGroupReportSocialMedia.workingGroupReportId,
				to: r.workingGroupReports.id,
				optional: false,
			}),
			socialMedia: r.one.socialMedia({
				from: r.workingGroupReportSocialMedia.socialMediaId,
				to: r.socialMedia.id,
				optional: false,
			}),
		},
		workingGroupReportEvents: {
			workingGroupReport: r.one.workingGroupReports({
				from: r.workingGroupReportEvents.workingGroupReportId,
				to: r.workingGroupReports.id,
				optional: false,
			}),
		},
		workingGroupReportQuestions: {
			campaign: r.one.reportingCampaigns({
				from: r.workingGroupReportQuestions.campaignId,
				to: r.reportingCampaigns.id,
				optional: false,
			}),
			answers: r.many.workingGroupReportAnswers({
				from: r.workingGroupReportQuestions.id,
				to: r.workingGroupReportAnswers.questionId,
			}),
		},
		workingGroupReportAnswers: {
			workingGroupReport: r.one.workingGroupReports({
				from: r.workingGroupReportAnswers.workingGroupReportId,
				to: r.workingGroupReports.id,
				optional: false,
			}),
			question: r.one.workingGroupReportQuestions({
				from: r.workingGroupReportAnswers.questionId,
				to: r.workingGroupReportQuestions.id,
				optional: false,
			}),
		},
		reportingCampaignEventAmounts: {
			campaign: r.one.reportingCampaigns({
				from: r.reportingCampaignEventAmounts.campaignId,
				to: r.reportingCampaigns.id,
				optional: false,
			}),
		},
		reportingCampaignSocialMediaAmounts: {
			campaign: r.one.reportingCampaigns({
				from: r.reportingCampaignSocialMediaAmounts.campaignId,
				to: r.reportingCampaigns.id,
				optional: false,
			}),
		},
		reportingCampaignContributionAmounts: {
			campaign: r.one.reportingCampaigns({
				from: r.reportingCampaignContributionAmounts.campaignId,
				to: r.reportingCampaigns.id,
				optional: false,
			}),
		},
		reportingCampaignServiceSizes: {
			campaign: r.one.reportingCampaigns({
				from: r.reportingCampaignServiceSizes.campaignId,
				to: r.reportingCampaigns.id,
				optional: false,
			}),
		},
		reportingCampaignCountryThresholds: {
			campaign: r.one.reportingCampaigns({
				from: r.reportingCampaignCountryThresholds.campaignId,
				to: r.reportingCampaigns.id,
				optional: false,
			}),
			// Resolve the document id to its published org-unit version through the documentLifecycle view (nullable).
			country: r.one.organisationalUnits({
				from: r.reportingCampaignCountryThresholds.countryDocumentId.through(
					r.documentLifecycle.documentId,
				),
				to: r.organisationalUnits.id.through(r.documentLifecycle.publishedId),
			}),
		},
		navigationMenus: {
			items: r.many.navigationItems({
				from: r.navigationMenus.id,
				to: r.navigationItems.menuId,
			}),
		},
		navigationItems: {
			menu: r.one.navigationMenus({
				from: r.navigationItems.menuId,
				to: r.navigationMenus.id,
				optional: false,
			}),
			parent: r.one.navigationItems({
				from: r.navigationItems.parentId,
				to: r.navigationItems.id,
				optional: true,
			}),
			children: r.many.navigationItems({
				from: r.navigationItems.id,
				to: r.navigationItems.parentId,
			}),
			entity: r.one.entities({
				from: r.navigationItems.entityId,
				to: r.entities.id,
				optional: true,
			}),
		},
		spotlightArticles: {
			contributors: r.many.persons({
				from: r.spotlightArticles.id.through(
					r.spotlightArticlesToPersons.spotlightArticleDocumentId,
				),
				to: r.persons.id.through(r.spotlightArticlesToPersons.personDocumentId),
			}),
			entityVersion: r.one.entityVersions({
				from: r.spotlightArticles.id,
				to: r.entityVersions.id,
				optional: false,
			}),
			image: r.one.assets({
				from: r.spotlightArticles.imageId,
				to: r.assets.id,
				optional: false,
			}),
		},
	};
});
