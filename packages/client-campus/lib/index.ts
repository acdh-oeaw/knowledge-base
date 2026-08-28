import { createUrl, createUrlSearchParams } from "@acdh-oeaw/lib";
import { type RequestResult, request } from "@dariah-eric/request";
import type { RequestError } from "@dariah-eric/request/errors";
import { Result } from "better-result";

export type DariahCampusResourceKind = "event" | "external" | "hosted" | "pathfinder";

export type DariahCampusResourceCollection =
	| "resourcesEvents"
	| "resourcesExternal"
	| "resourcesHosted"
	| "resourcesPathfinders";

export interface DariahCampusSummary {
	title: string;
	content: string;
}

export interface DariahCampusTag {
	id: string;
	name: string;
}

export interface DariahCampusPerson {
	id: string;
	name: string;
	orcid: string | null;
}

export interface DariahCampusSource {
	id: string;
	name: string;
}

export interface DariahCampusNationalConsortium {
	code: string;
	"sshoc-marketplace-id": string;
}

export interface DariahCampusWorkingGroup {
	"sshoc-marketplace-id": string;
	slug: string;
}

export interface DariahCampusResourceSummary extends DariahCampusSummary {}

/**
 * Only present on external resources (`kind: "external"`), pointing to where the resource is
 * hosted.
 */
export interface DariahCampusExternalResource {
	url: string;
	"publication-date"?: string;
}

export interface DariahCampusResource {
	id: string;
	collection: DariahCampusResourceCollection;
	kind: DariahCampusResourceKind;
	version: string;
	pid: string;
	external?: DariahCampusExternalResource;
	title: string;
	summary: DariahCampusSummary;
	license: string;
	locale: string;
	translations: Array<string>;
	"publication-date": string;
	"content-type": string;
	tags: Array<DariahCampusTag>;
	authors: Array<DariahCampusPerson>;
	editors: Array<DariahCampusPerson>;
	contributors: Array<DariahCampusPerson>;
	sources: Array<DariahCampusSource>;
	domain: string;
	"target-group": string;
	"dariah-national-consortia": Array<DariahCampusNationalConsortium>;
	"dariah-working-groups": Array<DariahCampusWorkingGroup>;
}

export interface DariahCampusCurriculumResource {
	id: string;
	collection: DariahCampusResourceCollection;
}

export interface DariahCampusCurriculum {
	id: string;
	collection: "curriculum";
	version: string;
	pid: string;
	title: string;
	summary: DariahCampusSummary;
	license: string;
	locale: string;
	translations: Array<string>;
	"publication-date": string;
	"content-type": "curriculum";
	tags: Array<DariahCampusTag>;
	editors: Array<DariahCampusPerson>;
	resources: Array<DariahCampusCurriculumResource>;
	domain: string;
	"target-group": string;
	"dariah-national-consortia": Array<DariahCampusNationalConsortium>;
	"dariah-working-groups": Array<DariahCampusWorkingGroup>;
}

export interface DariahCampusPaginatedResponse<TItem> {
	total: number;
	limit: number;
	offset: number;
	items: Array<TItem>;
}

export type DariahCampusResourceListItem = DariahCampusResource;
export type DariahCampusCurriculumListItem = DariahCampusCurriculum;

export interface ListDariahCampusResourcesParams {
	limit?: number;
	offset?: number;
	kind?: Array<DariahCampusResourceKind>;
	publicationYear?: string;
}

export interface ListDariahCampusCurriculaParams {
	limit?: number;
	offset?: number;
	publicationYear?: string;
}

export interface CreateDariahCampusClientConfig {
	baseUrl: string;
}

export interface CreateDariahCampusClientParams {
	config: CreateDariahCampusClientConfig;
}

const pageSize = 100;

function createListAll<TParams extends object, TItem>(
	getPage: (
		params: TParams & {
			limit: number;
			offset: number;
		},
	) => Promise<RequestResult<DariahCampusPaginatedResponse<TItem>>>,
): (params: TParams) => Promise<Result<Array<TItem>, RequestError>> {
	return (params) =>
		Result.gen(async function* () {
			const items: Array<TItem> = [];
			let offset = 0;
			let total = Infinity;

			// oxlint-disable-next-line typescript/no-unnecessary-condition
			while (offset < total) {
				// oxlint-disable-next-line no-await-in-loop
				const { data } = yield* Result.await(getPage({ ...params, limit: pageSize, offset }));
				items.push(...data.items);
				total = data.total;

				if (data.items.length === 0) {
					break;
				}

				offset += data.items.length;
			}

			return Result.ok(items);
		});
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createDariahCampusClient(params: CreateDariahCampusClientParams) {
	const { baseUrl } = params.config;

	function listResources(
		params: ListDariahCampusResourcesParams = {},
	): Promise<RequestResult<DariahCampusPaginatedResponse<DariahCampusResource>>> {
		const { limit, offset, kind, publicationYear } = params;

		return request<DariahCampusPaginatedResponse<DariahCampusResource>>(
			createUrl({
				baseUrl,
				pathname: "/api/v2/metadata/resources",
				searchParams: createUrlSearchParams({
					limit,
					offset,
					kind,
					"publication-year": publicationYear,
				}),
			}),
			{ responseType: "json" },
		);
	}

	function listCurricula(
		params: ListDariahCampusCurriculaParams = {},
	): Promise<RequestResult<DariahCampusPaginatedResponse<DariahCampusCurriculum>>> {
		const { limit, offset, publicationYear } = params;

		return request<DariahCampusPaginatedResponse<DariahCampusCurriculum>>(
			createUrl({
				baseUrl,
				pathname: "/api/v2/metadata/curricula",
				searchParams: createUrlSearchParams({
					limit,
					offset,
					"publication-year": publicationYear,
				}),
			}),
			{ responseType: "json" },
		);
	}

	return {
		curricula: {
			list(
				params: ListDariahCampusCurriculaParams = {},
			): Promise<RequestResult<DariahCampusPaginatedResponse<DariahCampusCurriculum>>> {
				return listCurricula(params);
			},

			listAll(
				params: Omit<ListDariahCampusCurriculaParams, "limit" | "offset"> = {},
			): Promise<Result<Array<DariahCampusCurriculum>, RequestError>> {
				return createListAll((pageParams) => listCurricula(pageParams))(params);
			},
		},

		resources: {
			list(
				params: ListDariahCampusResourcesParams = {},
			): Promise<RequestResult<DariahCampusPaginatedResponse<DariahCampusResource>>> {
				return listResources(params);
			},

			listAll(
				params: Omit<ListDariahCampusResourcesParams, "limit" | "offset"> = {},
			): Promise<Result<Array<DariahCampusResource>, RequestError>> {
				return createListAll((pageParams) => listResources(pageParams))(params);
			},
		},
	};
}

export type DariahCampusClient = ReturnType<typeof createDariahCampusClient>;
