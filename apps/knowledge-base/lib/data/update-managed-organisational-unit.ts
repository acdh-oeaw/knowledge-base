import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import type { ContentBlockInput } from "@/lib/content-block-input";
import { ensureDraftVersion, touchVersion } from "@/lib/data/entity-lifecycle";
import { replaceEntityVersionFieldContentBlocks } from "@/lib/data/entity-version-fields";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { syncOrganisationalUnitSocialMedia } from "@/lib/data/social-media-relations";
import type { Transaction } from "@/lib/db";
import { eq } from "@/lib/db/sql";

interface ManagedOrganisationalUnitUpdate {
	documentId: string;
	name?: string;
	acronym: string | null;
	email?: string | null;
	mailingList?: string | null;
	summary: string | null;
	sshocMarketplaceActorId: number | null;
	ror?: string | null;
	imageKey: string | null;
	descriptionContentBlocks: Array<ContentBlockInput>;
	socialMediaIds: Array<string>;
}

/** Saves the fields exposed on delegated non-admin forms. Publishing remains admin-only. */
export async function updateManagedOrganisationalUnitDraft(
	tx: Transaction,
	input: ManagedOrganisationalUnitUpdate,
): Promise<void> {
	const draftVersionId = await ensureDraftVersion(
		tx,
		input.documentId,
		organisationalUnitsLifecycleAdapter,
	);

	let imageId: string | null = null;
	if (input.imageKey != null) {
		const asset = await tx.query.assets.findFirst({
			where: { key: input.imageKey },
			columns: { id: true },
		});
		assert(asset);
		imageId = asset.id;
	}

	await tx
		.update(schema.organisationalUnits)
		.set({
			acronym: input.acronym,
			email: input.email,
			imageId,
			mailingList: input.mailingList,
			name: input.name,
			ror: input.ror,
			sshocMarketplaceActorId: input.sshocMarketplaceActorId,
			summary: input.summary,
		})
		.where(eq(schema.organisationalUnits.id, draftVersionId));

	await replaceEntityVersionFieldContentBlocks(
		tx,
		draftVersionId,
		"description",
		input.descriptionContentBlocks,
	);

	await syncOrganisationalUnitSocialMedia(tx, draftVersionId, input.socialMediaIds);

	await touchVersion(tx, draftVersionId);
}
