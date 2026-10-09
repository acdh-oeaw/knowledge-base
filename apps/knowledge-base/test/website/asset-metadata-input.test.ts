import { getFormDataValues } from "@acdh-oeaw/lib";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { UpdateAssetMetadataInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/assets/_lib/update-asset-metadata.schema";

/** Parses a submitted form the way `createMutationAction` does. */
function parseForm(entries: Record<string, string>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(entries)) {
		formData.set(key, value);
	}

	return v.parse(UpdateAssetMetadataInputSchema, getFormDataValues(formData));
}

describe("asset metadata form input", () => {
	it("clears alt text that was emptied", () => {
		/* `getFormDataValues` drops empty inputs, so an emptied field never reaches the schema — it
		   still has to end up as an explicit `null` rather than dropping out of the update. */
		expect(parseForm({ id: "asset-id", label: "Portrait", alt: "" })).toStrictEqual({
			id: "asset-id",
			label: "Portrait",
			alt: null,
			caption: null,
			licenseId: null,
		});
	});

	it("keeps submitted values", () => {
		expect(
			parseForm({
				id: "asset-id",
				label: "  Portrait  ",
				alt: "  A portrait  ",
				licenseId: "license-id",
			}),
		).toMatchObject({
			label: "Portrait",
			alt: "A portrait",
			licenseId: "license-id",
		});
	});

	it("reads the no-license option as no license", () => {
		expect(
			parseForm({ id: "asset-id", label: "Portrait", licenseId: "none" }).licenseId,
		).toBeNull();
	});

	it("requires a label", () => {
		expect(() => parseForm({ id: "asset-id", label: "   " })).toThrow();
	});
});
