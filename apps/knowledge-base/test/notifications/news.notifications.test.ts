import { assert } from "@acdh-oeaw/lib";
import * as schema from "@acdh-knowledge-base/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { discardNewsItemDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/news/_lib/discard-news-item-draft.action";
import { publishNewsItemAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/news/_lib/publish-news-item.action";
import { createDraftDocument, publishVersion } from "@/lib/data/entity-lifecycle";
import { newsLifecycleAdapter } from "@/lib/data/news.lifecycle-adapter";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

const { afterCallbacks, mockSyncWebsiteDocumentForEntity, mockDispatchWebhook } = vi.hoisted(() => {
	const afterCallbacks: Array<() => Promise<void>> = [];
	return {
		afterCallbacks,
		mockSyncWebsiteDocumentForEntity: vi.fn().mockResolvedValue(undefined),
		mockDispatchWebhook: vi.fn().mockResolvedValue(undefined),
	};
});

vi.mock("next/server", () => {
	return {
		after(cb: () => Promise<void>) {
			afterCallbacks.push(cb);
		},
	};
});

vi.mock("next/cache", () => {
	return { revalidatePath: vi.fn() };
});

vi.mock("next-intl/server", () => {
	return {
		getLocale: vi.fn().mockResolvedValue("en"),
		getExtracted: vi.fn().mockResolvedValue((key: string) => key),
	};
});

vi.mock("@acdh-knowledge-base/next-lib/rate-limiter", () => {
	return { globalPostRequestRateLimit: vi.fn().mockResolvedValue(true) };
});

vi.mock("@/lib/auth/session", () => {
	return { assertAdmin: vi.fn().mockResolvedValue({ user: null }) };
});

vi.mock("@/lib/navigation/navigation", () => {
	return { redirect: vi.fn() };
});

vi.mock("@/lib/search/website-index", () => {
	return {
		syncWebsiteDocumentForEntity: mockSyncWebsiteDocumentForEntity,
	};
});

vi.mock("@/lib/webhook/dispatch-webhook", () => {
	return {
		dispatchWebhook: mockDispatchWebhook,
	};
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedCommittedDraftNews(title = f.lorem.sentence()) {
	return db.transaction(async (tx) => {
		const type = await tx.query.entityTypes.findFirst({
			where: { type: "news" },
			columns: { id: true },
		});
		assert(type, "news entity type not found in database");

		const asset = await tx.query.assets.findFirst({ columns: { id: true } });
		assert(asset, "No asset found in database — seed one first.");

		const { documentId, versionId } = await createDraftDocument(tx, type.id, slugify(title));
		await tx
			.insert(schema.news)
			.values({ id: versionId, title, summary: f.lorem.paragraph(), imageId: asset.id });

		return { documentId, versionId };
	});
}

async function cleanupNewsDocument(documentId: string): Promise<void> {
	await db.transaction(async (tx) => {
		const versions = await tx
			.select({ id: schema.entityVersions.id })
			.from(schema.entityVersions)
			.where(eq(schema.entityVersions.entityId, documentId));

		for (const version of versions) {
			await tx.delete(schema.news).where(eq(schema.news.id, version.id));
			await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, version.id));
		}

		await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
	});
}

async function runAfterCallbacks(): Promise<void> {
	const pending = afterCallbacks.splice(0);
	for (const cb of pending) {
		await cb();
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("news action notifications", () => {
	afterEach(() => {
		vi.clearAllMocks();
		afterCallbacks.length = 0;
	});

	it("publishNewsItemAction fires sync and webhook after publish", async () => {
		const { documentId } = await seedCommittedDraftNews();

		try {
			await publishNewsItemAction(documentId);

			expect(mockSyncWebsiteDocumentForEntity).not.toHaveBeenCalled();
			expect(mockDispatchWebhook).not.toHaveBeenCalled();

			await runAfterCallbacks();

			expect(mockSyncWebsiteDocumentForEntity).toHaveBeenCalledOnce();
			expect(mockSyncWebsiteDocumentForEntity).toHaveBeenCalledWith(documentId);
			expect(mockDispatchWebhook).toHaveBeenCalledOnce();
			expect(mockDispatchWebhook).toHaveBeenCalledWith({ type: "news" });
		} finally {
			await cleanupNewsDocument(documentId);
		}
	});

	it("discardNewsItemDraftAction does not fire sync or webhook", async () => {
		const { documentId } = await seedCommittedDraftNews();

		await db.transaction(async (tx) => {
			await publishVersion(tx, documentId, newsLifecycleAdapter);
		});

		try {
			await discardNewsItemDraftAction(documentId);

			await runAfterCallbacks();

			expect(mockSyncWebsiteDocumentForEntity).not.toHaveBeenCalled();
			expect(mockDispatchWebhook).not.toHaveBeenCalled();
		} finally {
			await cleanupNewsDocument(documentId);
		}
	});
});
