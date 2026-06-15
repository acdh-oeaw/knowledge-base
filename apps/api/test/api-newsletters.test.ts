import { HttpError } from "@acdh-knowledge-base/request/errors";
import { Result } from "better-result";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { subscribeToNewsletter } from "@/routes/newsletters/service";
import { env } from "~/config/env.config";
import { createTestClient } from "~/test/lib/create-test-client";

const { mailchimp } = vi.hoisted(() => {
	return {
		mailchimp: {
			get: vi.fn(),
			subscribe: vi.fn(),
		},
	};
});

vi.mock("@/services/mailchimp", () => {
	return { mailchimp };
});

describe("newsletters", () => {
	const headers = { "x-api-access-token": env.API_ACCESS_TOKEN ?? "" };

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("GET /api/newsletters", () => {
		it("should return newsletter campaigns with a fallback title when subject line is missing", async () => {
			mailchimp.get.mockResolvedValue(
				Result.ok({
					data: {
						campaigns: [
							{
								id: "campaign-id",
								archive_url: "https://example.com/newsletter",
								send_time: undefined,
								settings: {
									subject_line: undefined,
									title: "Newsletter title",
								},
								status: "sent",
							},
						],
						total_items: 1,
					},
					headers: new Headers(),
				}),
			);

			const client = createTestClient(undefined as never);

			const response = await client.newsletters.$get({
				query: {
					limit: "10",
					offset: "0",
				},
			});

			expect(response.status).toBe(200);
			expect(mailchimp.get).toHaveBeenCalledWith({ count: 10, offset: 0, status: "sent" });
			await expect(response.json()).resolves.toEqual({
				data: [
					{
						id: "campaign-id",
						subject_line: "Newsletter title",
						send_time: null,
						archive_url: "https://example.com/newsletter",
						status: "sent",
					},
				],
				limit: 10,
				offset: 0,
				total: 1,
			});
		});
	});

	describe("POST /api/newsletters/subscribe", () => {
		it("should require the api access token header", async () => {
			const client = createTestClient(undefined as never);

			const response = await client.newsletters.subscribe.$post({
				json: {
					email: "test@example.com",
				},
			});

			expect(response.status).toBe(401);
			expect(mailchimp.subscribe).not.toHaveBeenCalled();
			await expect(response.json()).resolves.toEqual({
				message: "Unauthorized",
			});
		});

		it("should subscribe an email address", async () => {
			mailchimp.subscribe.mockResolvedValue(
				Result.ok({
					data: {
						email_address: "test@example.com",
					},
					headers: new Headers(),
				}),
			);

			const client = createTestClient(undefined as never);

			const response = await client.newsletters.subscribe.$post(
				{
					json: {
						email: "test@example.com",
					},
				},
				{ headers },
			);

			expect(response.status).toBe(201);
			expect(mailchimp.subscribe).toHaveBeenCalledWith({ email: "test@example.com" });
			await expect(response.json()).resolves.toEqual({
				email: "test@example.com",
			});
		});

		it("should reject invalid email addresses", async () => {
			const client = createTestClient(undefined as never);

			const response = await client.newsletters.subscribe.$post(
				{
					json: {
						email: "invalid-email",
					},
				},
				{ headers },
			);

			expect(response.status).toBe(400);
			expect(mailchimp.subscribe).not.toHaveBeenCalled();
		});

		it("should return a specific message when the email is already subscribed", async () => {
			mailchimp.subscribe.mockResolvedValue(
				Result.err(
					new HttpError({
						request: new Request("https://example.com"),
						response: Response.json(
							{ title: "Member Exists" },
							{
								status: 400,
								headers: { "content-type": "application/json" },
							},
						),
					}),
				),
			);

			const client = createTestClient(undefined as never);

			const response = await client.newsletters.subscribe.$post(
				{
					json: {
						email: "test@example.com",
					},
				},
				{ headers },
			);

			expect(response.status).toBe(400);
			await expect(response.json()).resolves.toEqual({
				message: "Already subscribed",
			});
		});

		it("should forward the Mailchimp fake or invalid email message", async () => {
			mailchimp.subscribe.mockResolvedValue(
				Result.err(
					new HttpError({
						request: new Request("https://example.com"),
						response: Response.json(
							{
								detail:
									"test@example.com looks fake or invalid, please enter a real email address.",
							},
							{
								status: 400,
								headers: { "content-type": "application/json" },
							},
						),
					}),
				),
			);

			const client = createTestClient(undefined as never);

			const response = await client.newsletters.subscribe.$post(
				{
					json: {
						email: "test@example.com",
					},
				},
				{ headers },
			);

			expect(response.status).toBe(400);
			await expect(response.json()).resolves.toEqual({
				message: "test@example.com looks fake or invalid, please enter a real email address.",
			});
		});

		it("should log the Mailchimp validation error payload", async () => {
			mailchimp.subscribe.mockResolvedValue(
				Result.err(
					new HttpError({
						request: new Request("https://example.com"),
						response: Response.json(
							{
								detail:
									"test@example.com looks fake or invalid, please enter a real email address.",
							},
							{
								status: 400,
								headers: { "content-type": "application/json" },
							},
						),
					}),
				),
			);

			const logger = {
				error: vi.fn(),
			};

			await expect(
				subscribeToNewsletter({ email: "test@example.com", logger }),
			).rejects.toMatchObject({
				status: 400,
			});

			expect(logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					email: "test@example.com",
					mailchimp: {
						detail: "test@example.com looks fake or invalid, please enter a real email address.",
					},
					status: 400,
				}),
				"Newsletter subscription failed",
			);
		});
	});
});
