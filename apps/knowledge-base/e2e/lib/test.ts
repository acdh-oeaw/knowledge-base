/* eslint-disable react-hooks/rules-of-hooks */

import { createUrl } from "@acdh-oeaw/lib";
import { test as base } from "@playwright/test";

import { env } from "@/config/env.config";
import { type AccessibilityScanner, createAccessibilityScanner } from "@/e2e/lib/fixtures/a11y";
import { AdminCountriesPage } from "@/e2e/lib/fixtures/admin-countries-page";
import { AdminCountryReportsPage } from "@/e2e/lib/fixtures/admin-country-reports-page";
import { AdminDocumentationPagesPage } from "@/e2e/lib/fixtures/admin-documentation-pages-page";
import { AdminFeaturedItemsPage } from "@/e2e/lib/fixtures/admin-featured-items-page";
import { AdminGovernanceBodiesPage } from "@/e2e/lib/fixtures/admin-governance-bodies-page";
import { AdminInstitutionsPage } from "@/e2e/lib/fixtures/admin-institutions-page";
import { AdminInternalPagesPage } from "@/e2e/lib/fixtures/admin-internal-pages-page";
import { AdminNationalConsortiaPage } from "@/e2e/lib/fixtures/admin-national-consortia-page";
import { AdminPersonsPage } from "@/e2e/lib/fixtures/admin-persons-page";
import { AdminProjectsPage } from "@/e2e/lib/fixtures/admin-projects-page";
import { AdminReportingCampaignsPage } from "@/e2e/lib/fixtures/admin-reporting-campaigns-page";
import { AdminServicesPage } from "@/e2e/lib/fixtures/admin-services-page";
import { AdminSocialMediaPage } from "@/e2e/lib/fixtures/admin-social-media-page";
import { AdminUsersPage } from "@/e2e/lib/fixtures/admin-users-page";
import { AdminWorkingGroupReportsPage } from "@/e2e/lib/fixtures/admin-working-group-reports-page";
import { AdminWorkingGroupsPage } from "@/e2e/lib/fixtures/admin-working-groups-page";
import { AssetsPage } from "@/e2e/lib/fixtures/assets-page";
import { ContactPage } from "@/e2e/lib/fixtures/contact-page";
import { DatabaseService } from "@/e2e/lib/fixtures/database-service";
import { type EmailService, createEmailService } from "@/e2e/lib/fixtures/email-service";
import { type I18n, type WithI18n, createI18n } from "@/e2e/lib/fixtures/i18n";
import { ImprintPage } from "@/e2e/lib/fixtures/imprint-page";
import { IndexPage } from "@/e2e/lib/fixtures/index-page";
import { WebsiteDocumentsPoliciesPage } from "@/e2e/lib/fixtures/website-documents-policies-page";
import { WebsiteEventsPage } from "@/e2e/lib/fixtures/website-events-page";
import { WebsiteFundingCallsPage } from "@/e2e/lib/fixtures/website-funding-calls-page";
import { WebsiteImpactCaseStudiesPage } from "@/e2e/lib/fixtures/website-impact-case-studies-page";
import { WebsiteNewsPage } from "@/e2e/lib/fixtures/website-news-page";
import { WebsiteOpportunitiesPage } from "@/e2e/lib/fixtures/website-opportunities-page";
import { WebsitePagesPage } from "@/e2e/lib/fixtures/website-pages-page";
import { WebsiteSpotlightArticlesPage } from "@/e2e/lib/fixtures/website-spotlight-articles-page";
import { type IntlLocale, defaultLocale } from "@/lib/i18n/locales";

interface TestFixtures {
	// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
	beforeEachTest: void;

	createAccessibilityScanner: () => Promise<AccessibilityScanner>;
	createEmailService: () => EmailService;
	createI18n: (locale: IntlLocale) => Promise<I18n>;
	createContactPage: (locale: IntlLocale) => Promise<WithI18n<{ contactPage: ContactPage }>>;
	createImprintPage: (locale: IntlLocale) => Promise<WithI18n<{ imprintPage: ImprintPage }>>;
	createIndexPage: (locale: IntlLocale) => Promise<WithI18n<{ indexPage: IndexPage }>>;
	createAdminCountriesPage: (workerIndex: number) => AdminCountriesPage;
	createAdminCountryReportsPage: (workerIndex: number) => AdminCountryReportsPage;
	createAdminDocumentationPagesPage: (workerIndex: number) => AdminDocumentationPagesPage;
	createAdminGovernanceBodiesPage: (workerIndex: number) => AdminGovernanceBodiesPage;
	createAdminInstitutionsPage: (workerIndex: number) => AdminInstitutionsPage;
	createAdminInternalPagesPage: () => AdminInternalPagesPage;
	createAdminNationalConsortiaPage: (workerIndex: number) => AdminNationalConsortiaPage;
	createAdminPersonsPage: (workerIndex: number) => AdminPersonsPage;
	createAdminProjectsPage: (workerIndex: number) => AdminProjectsPage;
	createAdminReportingCampaignsPage: (workerIndex: number) => AdminReportingCampaignsPage;
	createAdminServicesPage: (workerIndex: number) => AdminServicesPage;
	createAdminFeaturedItemsPage: () => AdminFeaturedItemsPage;
	createAdminSocialMediaPage: (workerIndex: number) => AdminSocialMediaPage;
	createAdminUsersPage: (workerIndex: number) => AdminUsersPage;
	createAdminWorkingGroupReportsPage: (workerIndex: number) => AdminWorkingGroupReportsPage;
	createAdminWorkingGroupsPage: (workerIndex: number) => AdminWorkingGroupsPage;
	createAssetsPage: () => AssetsPage;
	createWebsiteDocumentsPoliciesPage: (workerIndex: number) => WebsiteDocumentsPoliciesPage;
	createWebsiteEventsPage: (workerIndex: number) => WebsiteEventsPage;
	createWebsiteFundingCallsPage: (workerIndex: number) => WebsiteFundingCallsPage;
	createWebsiteImpactCaseStudiesPage: (workerIndex: number) => WebsiteImpactCaseStudiesPage;
	createWebsiteNewsPage: (workerIndex: number) => WebsiteNewsPage;
	createWebsiteOpportunitiesPage: (workerIndex: number) => WebsiteOpportunitiesPage;
	createWebsitePagesPage: (workerIndex: number) => WebsitePagesPage;
	createWebsiteSpotlightArticlesPage: (workerIndex: number) => WebsiteSpotlightArticlesPage;
}

interface WorkerFixtures {
	db: DatabaseService;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
	/** @see {@link https://playwright.dev/docs/test-fixtures#adding-global-beforeeachaftereach-hooks} */
	beforeEachTest: [
		async ({ context }, use) => {
			if (env.NEXT_PUBLIC_APP_MATOMO_BASE_URL != null) {
				/**
				 * If we were to block loading the actual matomo javascript snippet, we would need to check
				 * if `windows._paq` was pushed to (because no requests to `matomo.php` would be
				 * dispatched).
				 */
				// const scriptUrl = String(
				// 	createUrl({ baseUrl: env.NEXT_PUBLIC_APP_MATOMO_BASE_URL, pathname: "/matomo.js" }),
				// );

				// await context.route(scriptUrl, (route) => {
				// 	return route.fulfill({ status: 200, body: "" });
				// });

				const baseUrl = String(
					createUrl({
						baseUrl: env.NEXT_PUBLIC_APP_MATOMO_BASE_URL,
						pathname: "/matomo.php?**",
					}),
				);

				await context.route(baseUrl, (route) => route.fulfill({ status: 204, body: "" }));
			}

			await use();
		},
		{ auto: true },
	],

	async createAccessibilityScanner({ page }, use) {
		await use(() => createAccessibilityScanner(page));
	},

	async createEmailService({ request }, use) {
		await use(() => createEmailService(request));
	},

	async createI18n({ page }, use) {
		await use((locale) => createI18n(page, locale));
	},

	async createContactPage({ page }, use) {
		async function createContactPage(locale = defaultLocale) {
			const i18n = await createI18n(page, locale);
			const contactPage = new ContactPage(page, locale, i18n);
			return { i18n, contactPage };
		}

		await use(createContactPage);
	},

	async createImprintPage({ page }, use) {
		async function createImprintPage(locale = defaultLocale) {
			const i18n = await createI18n(page, locale);
			const imprintPage = new ImprintPage(page, locale, i18n);
			return { i18n, imprintPage };
		}

		await use(createImprintPage);
	},

	async createIndexPage({ page }, use) {
		async function createIndexPage(locale = defaultLocale) {
			const i18n = await createI18n(page, locale);
			const indexPage = new IndexPage(page, locale, i18n);
			return { i18n, indexPage };
		}

		await use(createIndexPage);
	},

	async createAdminCountriesPage({ page }, use) {
		await use((workerIndex: number) => new AdminCountriesPage(page, workerIndex));
	},

	async createAdminCountryReportsPage({ page }, use) {
		await use((workerIndex: number) => new AdminCountryReportsPage(page, workerIndex));
	},

	async createAdminDocumentationPagesPage({ page }, use) {
		await use((workerIndex: number) => new AdminDocumentationPagesPage(page, workerIndex));
	},

	async createAdminGovernanceBodiesPage({ page }, use) {
		await use((workerIndex: number) => new AdminGovernanceBodiesPage(page, workerIndex));
	},

	async createAdminInstitutionsPage({ page }, use) {
		await use((workerIndex: number) => new AdminInstitutionsPage(page, workerIndex));
	},

	async createAdminInternalPagesPage({ page }, use) {
		await use(() => new AdminInternalPagesPage(page));
	},

	async createAdminNationalConsortiaPage({ page }, use) {
		await use((workerIndex: number) => new AdminNationalConsortiaPage(page, workerIndex));
	},

	async createAdminProjectsPage({ page }, use) {
		await use((workerIndex: number) => new AdminProjectsPage(page, workerIndex));
	},

	async createAdminReportingCampaignsPage({ page }, use) {
		await use((workerIndex: number) => new AdminReportingCampaignsPage(page, workerIndex));
	},

	async createAdminPersonsPage({ page }, use) {
		await use((workerIndex: number) => new AdminPersonsPage(page, workerIndex));
	},

	async createAdminServicesPage({ page }, use) {
		await use((workerIndex: number) => new AdminServicesPage(page, workerIndex));
	},

	async createAdminFeaturedItemsPage({ page }, use) {
		await use(() => new AdminFeaturedItemsPage(page));
	},

	async createAdminSocialMediaPage({ page }, use) {
		await use((workerIndex: number) => new AdminSocialMediaPage(page, workerIndex));
	},

	async createAdminUsersPage({ page }, use) {
		await use((workerIndex: number) => new AdminUsersPage(page, workerIndex));
	},

	async createAdminWorkingGroupReportsPage({ page }, use) {
		await use((workerIndex: number) => new AdminWorkingGroupReportsPage(page, workerIndex));
	},

	async createAdminWorkingGroupsPage({ page }, use) {
		await use((workerIndex: number) => new AdminWorkingGroupsPage(page, workerIndex));
	},

	async createAssetsPage({ page }, use) {
		await use(() => new AssetsPage(page));
	},

	async createWebsiteDocumentsPoliciesPage({ page }, use) {
		await use((workerIndex: number) => new WebsiteDocumentsPoliciesPage(page, workerIndex));
	},

	async createWebsiteEventsPage({ page }, use) {
		await use((workerIndex: number) => new WebsiteEventsPage(page, workerIndex));
	},

	async createWebsiteFundingCallsPage({ page }, use) {
		await use((workerIndex: number) => new WebsiteFundingCallsPage(page, workerIndex));
	},

	async createWebsiteImpactCaseStudiesPage({ page }, use) {
		await use((workerIndex: number) => new WebsiteImpactCaseStudiesPage(page, workerIndex));
	},

	async createWebsiteNewsPage({ page }, use) {
		await use((workerIndex: number) => new WebsiteNewsPage(page, workerIndex));
	},

	async createWebsiteOpportunitiesPage({ page }, use) {
		await use((workerIndex: number) => new WebsiteOpportunitiesPage(page, workerIndex));
	},

	async createWebsitePagesPage({ page }, use) {
		await use((workerIndex: number) => new WebsitePagesPage(page, workerIndex));
	},

	async createWebsiteSpotlightArticlesPage({ page }, use) {
		await use((workerIndex: number) => new WebsiteSpotlightArticlesPage(page, workerIndex));
	},

	db: [
		// eslint-disable-next-line no-empty-pattern
		async ({}, use) => {
			const db = new DatabaseService();
			await use(db);
			await db.close();
		},
		{ scope: "worker" },
	],
});

export { expect } from "@playwright/test";
