import { STATUS_CODES } from "node:http";

import { HttpError } from "@acdh-knowledge-base/request/errors";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { Logger } from "@/middlewares/logger";
import { mailchimp } from "@/services/mailchimp";

interface MailchimpErrorResponse {
	detail?: string;
	errors?: Array<{
		field?: string;
		message?: string;
	}>;
	title?: string;
}

interface GetNewslettersParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getNewsletters(params: GetNewslettersParams) {
	const { limit = 10, offset = 0 } = params;

	const result = (await mailchimp.get({ count: limit, offset, status: "sent" })).unwrap().data;

	const total = result.total_items;
	const data = result.campaigns.map((campaign) => {
		return {
			id: campaign.id,
			subject_line: campaign.settings.subject_line ?? campaign.settings.title ?? "",
			send_time: campaign.send_time ?? null,
			archive_url: campaign.archive_url,
			status: campaign.status,
		};
	});

	return { data, limit, offset, total };
}

interface SubscribeToNewsletterParams {
	email: string;
	logger?: Pick<Logger, "error">;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function subscribeToNewsletter(params: SubscribeToNewsletterParams) {
	const { email, logger } = params;

	const result = await mailchimp.subscribe({ email });

	if (result.isErr()) {
		const error = result.error;

		if (HttpError.is(error)) {
			const status = error.response.status;
			let message = STATUS_CODES[status] ?? STATUS_CODES[500];
			let data: MailchimpErrorResponse | undefined;

			if (status >= 400 && status < 500) {
				try {
					data = (await error.response.json()) as MailchimpErrorResponse;

					if (status === 400 && data.title === "Member Exists") {
						message = "Already subscribed";
					}

					if (
						status === 400 &&
						data.detail === `${email} looks fake or invalid, please enter a real email address.`
					) {
						message = data.detail;
					}
				} catch {
					/** Noop */
				}
			}

			logger?.error(
				{
					email,
					err: error,
					mailchimp: data,
					status,
				},
				"Newsletter subscription failed",
			);

			throw new HTTPException(status as ContentfulStatusCode, {
				cause: error,
				message,
			});
		}

		throw new HTTPException(500, {
			cause: error,
			message: STATUS_CODES[500],
		});
	}

	const { email_address } = result.value.data;

	return { email: email_address };
}
