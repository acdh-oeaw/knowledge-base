import * as v from "valibot";

import { partnerInstitutionStatusTypes } from "@/lib/data/wizard-preflight";

/**
 * One guided form, one submit: everything the partner-institution wizard collects across its steps
 * arrives in a single payload and is written in a single transaction.
 *
 * `institutionDocumentId` selects between the two shapes of step 1 — an existing institution was
 * picked, or a new one is described by `name` and the optional core fields. The wizard deliberately
 * collects only those: image, description blocks, social media, and related entities belong to the
 * full institution form, which the admin is offered a link to once the wizard has finished.
 */
export const CreatePartnerInstitutionActionInputSchema = v.pipe(
	v.object({
		institutionDocumentId: v.nullish(v.pipe(v.string(), v.uuid()), null),
		name: v.pipe(v.string(), v.nonEmpty()),
		acronym: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
		ror: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
		summary: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
		countryDocumentId: v.pipe(v.string(), v.uuid()),
		locatedInStart: v.pipe(v.string(), v.isoDate(), v.toDate()),
		statusType: v.picklist(partnerInstitutionStatusTypes),
		statusStart: v.pipe(v.string(), v.isoDate(), v.toDate()),
		statusEnd: v.nullish(v.pipe(v.string(), v.isoDate(), v.toDate()), null),
	}),
	v.forward(
		v.check(
			(input) => input.statusEnd == null || input.statusEnd > input.statusStart,
			"The end date must be after the start date.",
		),
		["statusEnd"],
	),
);

export type CreatePartnerInstitutionActionInput = v.InferOutput<
	typeof CreatePartnerInstitutionActionInputSchema
>;
