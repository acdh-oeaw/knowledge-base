import { createUrl, createUrlSearchParams } from "@acdh-oeaw/lib";
import { type RequestResult, request } from "@dariah-eric/request";
import type { RequestError } from "@dariah-eric/request/errors";
import { Result } from "better-result";

export type OpenAireResearchProductType = "publication" | "dataset" | "software" | "other";

export type OpenAireImpactClass = "C1" | "C2" | "C3" | "C4" | "C5";

export type OpenAireAccessRightLabel = "OPEN" | "RESTRICTED" | "CLOSED" | "EMBARGO" | "UNKNOWN";

export interface OpenAireLanguage {
	code: string;
	label: string;
}

export interface OpenAireSchemeValue {
	scheme: string;
	value: string;
}

export interface OpenAireKeyValue {
	key: string;
	value: string;
}

export interface OpenAireAccessRight {
	code: string;
	label: OpenAireAccessRightLabel;
	scheme: string;
	openAccessRoute?: string | null;
}

export interface OpenAireAuthor {
	fullName: string | null;
	name: string | null;
	surname: string | null;
	rank: number | null;
	pid: OpenAireSchemeValue | null;
}

export interface OpenAireProvenance {
	provenance: string;
	trust: string;
}

export interface OpenAireSubject {
	subject: {
		scheme: string;
		value: string;
	};
	provenance: OpenAireProvenance | null;
}

export interface OpenAireContainer {
	name: string | null;
	issnPrinted: string | null;
	issnOnline: string | null;
	issnLinking: string | null;
	ep: string | null;
	iss: string | null;
	sp: string | null;
	vol: string | null;
	edition: string | null;
	conferencePlace: string | null;
	conferenceDate: string | null;
}

export interface OpenAireInstance {
	pids: Array<OpenAireSchemeValue> | null;
	accessRight: OpenAireAccessRight | null;
	type: string | null;
	urls: Array<string> | null;
	publicationDate: string | null;
	refereed: string | null;
	hostedBy: OpenAireKeyValue | null;
	collectedFrom: OpenAireKeyValue | null;
}

export interface OpenAireOrganization {
	id: string | null;
	legalName: string | null;
	acronym: string | null;
	pids: Array<OpenAireSchemeValue> | null;
}

export interface OpenAireCitationImpact {
	citationCount: number;
	influence: number;
	popularity: number;
	impulse: number;
	citationClass: OpenAireImpactClass;
	influenceClass: OpenAireImpactClass;
	impulseClass: OpenAireImpactClass;
	popularityClass: OpenAireImpactClass;
}

export interface OpenAireIndicators {
	citationImpact: OpenAireCitationImpact | null;
}

export interface OpenAireFundingStream {
	id: string;
	description: string | null;
}

export interface OpenAireProjectFunding {
	fundingStream: OpenAireFundingStream;
	jurisdiction: string | null;
	name: string | null;
	shortName: string | null;
}

export interface OpenAireGrant {
	currency: string | null;
	fundedAmount: number | null;
	totalCost: number | null;
}

export interface OpenAireH2020Programme {
	code: string;
	description: string | null;
}

export interface ResearchProduct {
	id: string;
	type: OpenAireResearchProductType;
	mainTitle: string;
	subTitle: string | null;
	descriptions: Array<string> | null;
	publicationDate: string;
	publisher: string | null;
	embargoEndDate: string | null;
	openAccessColor: string | null;
	publiclyFunded: boolean | null;
	isGreen: boolean | null;
	isInDiamondJournal: boolean | null;
	bestAccessRight: OpenAireAccessRight | null;
	language: OpenAireLanguage;
	countries: Array<unknown> | null;
	authors: Array<OpenAireAuthor> | null;
	subjects: Array<OpenAireSubject> | null;
	pids: Array<OpenAireSchemeValue> | null;
	originalIds: Array<string> | null;
	sources: Array<string> | null;
	formats: Array<string> | null;
	contributors: Array<string> | null;
	coverages: Array<string> | null;
	documentationUrls: Array<string> | null;
	codeRepositoryUrl: string | null;
	programmingLanguage: string | null;
	contactPeople: Array<string> | null;
	contactGroups: Array<string> | null;
	tools: Array<string> | null;
	size: string | null;
	version: string | null;
	geoLocations: Array<unknown> | null;
	dateOfCollection: string | null;
	lastUpdateTimeStamp: number | null;
	container: OpenAireContainer | null;
	indicators: OpenAireIndicators | null;
	organizations: Array<OpenAireOrganization> | null;
	projects: Array<unknown> | null;
	communities: Array<unknown> | null;
	collectedFrom: Array<OpenAireKeyValue> | null;
	instances: Array<OpenAireInstance> | null;
}

export interface Project {
	id: string;
	code: string;
	acronym: string;
	title: string;
	callIdentifier: string | null;
	fundings: Array<OpenAireProjectFunding> | null;
	granted: OpenAireGrant | null;
	h2020Programmes: Array<OpenAireH2020Programme> | null;
	keywords: string | null;
	openAccessMandateForDataset: boolean | null;
	openAccessMandateForPublications: boolean | null;
	startDate: string | null;
	endDate: string | null;
	subjects: Array<string> | null;
	summary: string | null;
	websiteUrl: string | null;
}

export interface OpenAireListResponseHeader {
	numFound: number;
	numFoundExact?: boolean;
	maxScore: number;
	queryTime: number;
	page: number;
	pageSize: number;
	totalPages?: number;
	nextCursor?: string;
}

export interface ResearchProductsResponse {
	header: OpenAireListResponseHeader;
	results: Array<ResearchProduct>;
}

export interface ProjectsResponse {
	header: OpenAireListResponseHeader;
	results: Array<Project>;
}

export interface GetResearchProductsParams {
	/** Keyword search with AND/OR/NOT operators. */
	search?: string;
	mainTitle?: string;
	description?: string;
	id?: string;
	pid?: string;
	originalId?: string;
	type?: OpenAireResearchProductType;
	subjects?: string;
	/** Field of Science classification. */
	fos?: string;
	/** Sustainable Development Goal (1–17). */
	sdg?: string;
	fromPublicationDate?: string;
	toPublicationDate?: string;
	bestOpenAccessRightLabel?: OpenAireAccessRightLabel;
	openAccessColor?: "gold" | "hybrid" | "bronze";
	isPeerReviewed?: boolean;
	isGreen?: boolean;
	isInDiamondJournal?: boolean;
	isPubliclyFunded?: boolean;
	instanceType?: string;
	publisher?: string;
	influenceClass?: OpenAireImpactClass;
	popularityClass?: OpenAireImpactClass;
	impulseClass?: OpenAireImpactClass;
	citationCountClass?: OpenAireImpactClass;
	/**
	 * @example
	 * 	"openorgs____::f0c3e27c112272a3781226c5890b228c" for dariah
	 */
	relOrganizationId?: string;
	relProjectId?: string;
	relProjectCode?: string;
	/**
	 * @example
	 * 	"dariah" for dariah
	 */
	relCommunityId?: string;
	/**
	 * @example
	 * 	"issn__online::7d157c8f847606bf72bb8a4a1e8b1514" for transformations journal
	 */
	relHostingDataSourceId?: string;
	relCollectedFromDatasourceId?: string;
	sortBy?: string;
	page?: number;
	pageSize?: number;
	cursor?: string;
}

export interface GetProjectsParams {
	/** Keyword search with AND/OR/NOT operators. */
	search?: string;
	title?: string;
	keywords?: string;
	id?: string;
	code?: string;
	acronym?: string;
	callIdentifier?: string;
	fundingShortName?: string;
	fundingStreamId?: string;
	fromStartDate?: string;
	toStartDate?: string;
	fromEndDate?: string;
	toEndDate?: string;
	relOrganizationName?: string;
	relOrganizationId?: string;
	relCommunityId?: string;
	relOrganizationCountryCode?: string;
	relCollectedFromDatasourceId?: string;
	sortBy?: string;
	page?: number;
	pageSize?: number;
	cursor?: string;
}

export interface CreateOpenAireClientParams {
	config: {
		baseUrl: string;
	};
}

const pageSize = 100;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createOpenAireClient(params: CreateOpenAireClientParams) {
	const { baseUrl } = params.config;

	/** @see {@link https://graph.openaire.eu/docs/apis/graph-api/} */
	function getResearchProducts(
		params: GetResearchProductsParams,
	): Promise<RequestResult<ResearchProductsResponse>> {
		const {
			search,
			mainTitle,
			description,
			id,
			pid,
			originalId,
			type,
			subjects,
			fos,
			sdg,
			fromPublicationDate,
			toPublicationDate,
			bestOpenAccessRightLabel,
			openAccessColor,
			isPeerReviewed,
			isGreen,
			isInDiamondJournal,
			isPubliclyFunded,
			instanceType,
			publisher,
			influenceClass,
			popularityClass,
			impulseClass,
			citationCountClass,
			relOrganizationId,
			relProjectId,
			relProjectCode,
			relCommunityId,
			relHostingDataSourceId,
			relCollectedFromDatasourceId,
			sortBy,
			page,
			pageSize: limit,
			cursor,
		} = params;

		return request<ResearchProductsResponse>(
			createUrl({
				baseUrl,
				pathname: "/graph/v2/researchProducts",
				searchParams: createUrlSearchParams({
					search,
					mainTitle,
					description,
					id,
					pid,
					originalId,
					type,
					subjects,
					fos,
					sdg,
					fromPublicationDate,
					toPublicationDate,
					bestOpenAccessRightLabel,
					openAccessColor,
					isPeerReviewed,
					isGreen,
					isInDiamondJournal,
					isPubliclyFunded,
					instanceType,
					publisher,
					influenceClass,
					popularityClass,
					impulseClass,
					citationCountClass,
					relOrganizationId,
					relProjectId,
					relProjectCode,
					relCommunityId,
					relHostingDataSourceId,
					relCollectedFromDatasourceId,
					sortBy,
					page,
					pageSize: limit,
					cursor,
				}),
			}),
			{ responseType: "json" },
		);
	}

	function getProjects(params: GetProjectsParams): Promise<RequestResult<ProjectsResponse>> {
		const {
			search,
			title,
			keywords,
			id,
			code,
			acronym,
			callIdentifier,
			fundingShortName,
			fundingStreamId,
			fromStartDate,
			toStartDate,
			fromEndDate,
			toEndDate,
			relOrganizationName,
			relOrganizationId,
			relCommunityId,
			relOrganizationCountryCode,
			relCollectedFromDatasourceId,
			sortBy,
			page,
			pageSize: limit,
			cursor,
		} = params;

		return request<ProjectsResponse>(
			createUrl({
				baseUrl,
				pathname: "/graph/v2/projects",
				searchParams: createUrlSearchParams({
					search,
					title,
					keywords,
					id,
					code,
					acronym,
					callIdentifier,
					fundingShortName,
					fundingStreamId,
					fromStartDate,
					toStartDate,
					fromEndDate,
					toEndDate,
					relOrganizationName,
					relOrganizationId,
					relCommunityId,
					relOrganizationCountryCode,
					relCollectedFromDatasourceId,
					sortBy,
					page,
					pageSize: limit,
					cursor,
				}),
			}),
			{ responseType: "json" },
		);
	}

	return {
		projects: {
			list(params: GetProjectsParams = {}): Promise<RequestResult<ProjectsResponse>> {
				return getProjects(params);
			},

			listAll(
				params: Omit<GetProjectsParams, "cursor" | "page" | "pageSize">,
			): Promise<Result<Array<Project>, RequestError>> {
				return Result.gen(async function* () {
					const items: Array<Project> = [];
					let cursor: string | undefined = "*";

					while (cursor != null) {
						const pageCursor: string = cursor;
						const { data } = yield* Result.await(
							getProjects({ ...params, cursor: pageCursor, pageSize }),
						);
						items.push(...data.results);
						cursor = data.header.nextCursor;
					}

					return Result.ok(items);
				});
			},
		},

		researchProducts: {
			list(
				params: GetResearchProductsParams = {},
			): Promise<RequestResult<ResearchProductsResponse>> {
				return getResearchProducts(params);
			},

			listAll(
				params: Omit<GetResearchProductsParams, "cursor" | "page" | "pageSize">,
			): Promise<Result<Array<ResearchProduct>, RequestError>> {
				return Result.gen(async function* () {
					const items: Array<ResearchProduct> = [];
					let cursor: string | undefined = "*";

					while (cursor != null) {
						const pageCursor: string = cursor;
						const { data } = yield* Result.await(
							getResearchProducts({ ...params, cursor: pageCursor, pageSize }),
						);
						items.push(...data.results);
						cursor = data.header.nextCursor;
					}

					return Result.ok(items);
				});
			},
		},
	};
}

export type OpenAireClient = ReturnType<typeof createOpenAireClient>;
