import * as v from "valibot";

export const UpdateUserActionInputSchema = v.pipe(
	v.object({
		id: v.pipe(v.string(), v.uuid()),
		name: v.pipe(v.string(), v.nonEmpty()),
		email: v.pipe(v.string(), v.email()),
		role: v.picklist(["admin", "user"] as const),
		canManageAdmins: v.optional(v.literal("true")),
		personId: v.optional(v.pipe(v.string(), v.uuid())),
		organisationalUnitId: v.optional(v.pipe(v.string(), v.uuid())),
	}),
	v.check(
		({ personId, organisationalUnitId }) => !(personId != null && organisationalUnitId != null),
		"A user can only be linked to a person or a country, not both.",
	),
	v.check(
		({ canManageAdmins, role }) => canManageAdmins == null || role === "admin",
		"Only admins can manage other admins.",
	),
);
