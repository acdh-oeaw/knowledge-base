import type { User } from "@acdh-knowledge-base/auth";
import { forbidden } from "next/navigation";

import { type GetCampaignsResponse, mailchimp } from "@/lib/mailchimp";

export type Newsletter = GetCampaignsResponse["campaigns"][number];

interface GetNewslettersParams {
	limit: number;
	offset: number;
	q?: string;
}

export interface NewslettersResult {
	data: Array<Newsletter>;
	limit: number;
	offset: number;
	total: number;
}

function assertAdminUser(user: Pick<User, "role">): void {
	if (user.role !== "admin") {
		forbidden();
	}
}

export async function getNewsletters(
	params: Readonly<GetNewslettersParams>,
): Promise<NewslettersResult> {
	const { limit, offset, q } = params;
	const query = q?.trim().toLowerCase();

	if (query == null || query === "") {
		const result = await mailchimp.get({ count: limit, offset });
		const data: GetCampaignsResponse = result.unwrap().data;

		return {
			data: [...data.campaigns],
			limit,
			offset,
			total: data.total_items,
		};
	}

	const result = await mailchimp.get({ count: 1000, offset: 0 });
	const data: GetCampaignsResponse = result.unwrap().data;
	const filtered = [...data.campaigns].filter((campaign) =>
		campaign.settings.subject_line.toLowerCase().includes(query),
	);

	return {
		data: filtered.slice(offset, offset + limit),
		limit,
		offset,
		total: filtered.length,
	};
}

export async function getNewslettersForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetNewslettersParams>,
): Promise<NewslettersResult> {
	assertAdminUser(currentUser);

	return getNewsletters(params);
}
