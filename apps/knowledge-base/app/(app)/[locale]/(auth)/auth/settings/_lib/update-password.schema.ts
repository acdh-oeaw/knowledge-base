import * as v from "valibot";

export const UpdatePasswordActionInputSchema = v.pipe(
	v.object({
		password: v.pipe(v.string(), v.nonEmpty()),
		"new-password": v.pipe(v.string(), v.nonEmpty()),
		"new-password-confirmation": v.pipe(v.string(), v.nonEmpty()),
	}),
	v.forward(
		v.partialCheck(
			[["new-password"], ["new-password-confirmation"]],
			(input) => input["new-password-confirmation"] === input["new-password"],
			"Passwords don't match.",
		),
		["new-password-confirmation"],
	),
);
