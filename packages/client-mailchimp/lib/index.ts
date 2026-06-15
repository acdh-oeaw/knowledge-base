import { createUrl, createUrlSearchParams } from "@acdh-oeaw/lib";
import { type RequestResult, request } from "@acdh-knowledge-base/request";
import type { RequestError } from "@acdh-knowledge-base/request/errors";
import { Result } from "better-result";

export type CampaignType = "regular" | "plaintext" | "absplit" | "rss" | "variate";

export type CampaignStatus =
	| "save"
	| "paused"
	| "schedule"
	| "sending"
	| "sent"
	| "canceled"
	| "canceling"
	| "archived";

export interface Campaign {
	id: string;
	web_id: string;
	type: CampaignType;
	status: CampaignStatus;
	create_time: string;
	send_time?: string;
	emails_sent: number;
	archive_url: string;
	settings: {
		subject_line: string;
		preview_text?: string;
		title: string;
		from_name: string;
		reply_to: string;
	};
}

export interface ListCampaignsResponse {
	campaigns: Array<Campaign>;
	total_items: number;
}

export interface SubscribeResponse {
	id: string;
	email_address: string;
	status: "subscribed" | "unsubscribed" | "cleaned" | "pending" | "transactional";
}

export interface ListCampaignsParams {
	count?: number;
	offset?: number;
	type?: CampaignType;
	status?: CampaignStatus;
	beforeSendTime?: string;
	sinceSendTime?: string;
	beforeCreateTime?: string;
	sinceCreateTime?: string;
	sortField?: "create_time" | "send_time";
	sortDir?: "ASC" | "DESC";
}

export interface CreateMailchimpClientParams {
	config: {
		apiKey: string;
		baseUrl: string;
		listId: string;
	};
}

const pageSize = 1000;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createMailchimpClient(params: CreateMailchimpClientParams) {
	const { config } = params;

	const { apiKey, baseUrl, listId } = config;

	const credentials = `key:${apiKey}`;

	const headers = {
		Authorization: `Basic ${Buffer.from(credentials, "utf-8").toString("base64")}`,
	};

	function getCampaigns(
		params: ListCampaignsParams,
	): Promise<RequestResult<ListCampaignsResponse>> {
		const {
			count,
			offset,
			type,
			status,
			beforeSendTime,
			sinceSendTime,
			beforeCreateTime,
			sinceCreateTime,
			sortField,
			sortDir,
		} = params;

		/** @see {@link https://mailchimp.com/developer/marketing/api/campaigns/list-campaigns/} */
		return request<ListCampaignsResponse>(
			createUrl({
				baseUrl,
				pathname: "/3.0/campaigns",
				searchParams: createUrlSearchParams({
					count,
					offset,
					list_id: listId,
					type,
					status,
					before_send_time: beforeSendTime,
					since_send_time: sinceSendTime,
					before_create_time: beforeCreateTime,
					since_create_time: sinceCreateTime,
					sort_field: sortField,
					sort_dir: sortDir,
				}),
			}),
			{ headers, responseType: "json" },
		);
	}

	return {
		campaigns: {
			list(params: ListCampaignsParams = {}): Promise<RequestResult<ListCampaignsResponse>> {
				return getCampaigns(params);
			},

			listAll(
				params: Omit<ListCampaignsParams, "count" | "offset"> = {},
			): Promise<Result<Array<Campaign>, RequestError>> {
				return Result.gen(async function* () {
					const items: Array<Campaign> = [];
					let offset = 0;
					let totalItems;

					do {
						const { data } = yield* Result.await(
							getCampaigns({ ...params, count: pageSize, offset }),
						);
						items.push(...data.campaigns);
						totalItems = data.total_items;
						offset += pageSize;
					} while (offset < totalItems);

					return Result.ok(items);
				});
			},
		},

		contacts: {
			subscribe(params: { email: string }): Promise<RequestResult<SubscribeResponse>> {
				const { email } = params;

				/** @see {@link https://mailchimp.com/developer/marketing/api/list-members/add-member-to-list/} */
				return request<SubscribeResponse>(
					createUrl({
						baseUrl,
						pathname: `/3.0/lists/${listId}/members`,
						searchParams: createUrlSearchParams({
							/**
							 * Currently `FNAME` and `LNAME` custom `merge_fields` are still required in
							 * `mailchimp` settings, but the subscription forms only provide `email`.
							 */
							skip_merge_validation: true,
						}),
					}),
					{
						body: {
							email_address: email,
							status: "pending",
							/** @see {@link https://mailchimp.com/developer/marketing/docs/merge-fields/} */
							merge_fields: {},
						},
						headers,
						method: "post",
						responseType: "json",
					},
				);
			},
		},
	};
}

export type MailChimpClient = ReturnType<typeof createMailchimpClient>;
