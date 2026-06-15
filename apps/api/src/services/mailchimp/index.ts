import { assert } from "@acdh-oeaw/lib";
import {
	type CreateListMemberResponse,
	type GetCampaignsResponse,
	createMailchimpClient,
} from "@acdh-knowledge-base/mailchimp";

import { env } from "~/config/env.config";

assert(env.MAILCHIMP_API_KEY, "Missing environment variable `MAILCHIMP_API_KEY`.");
assert(env.MAILCHIMP_API_BASE_URL, "Missing environment variable `MAILCHIMP_API_BASE_URL`.");
assert(env.MAILCHIMP_LIST_ID, "Missing environment variable `MAILCHIMP_LIST_ID`.");

export const mailchimp = createMailchimpClient({
	config: {
		apiKey: env.MAILCHIMP_API_KEY,
		baseUrl: env.MAILCHIMP_API_BASE_URL,
		listId: env.MAILCHIMP_LIST_ID,
	},
});

export type { CreateListMemberResponse, GetCampaignsResponse };
