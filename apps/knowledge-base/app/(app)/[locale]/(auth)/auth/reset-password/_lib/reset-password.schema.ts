import * as v from "valibot";

import { passwords } from "@/config/auth.config";

export const ResetPasswordActionInputSchema = v.pipe(
	v.object({
		password: v.pipe(
			v.string(),
			v.minLength(passwords.length.min),
			v.maxLength(passwords.length.max),
		),
		"password-confirmation": v.pipe(v.string(), v.nonEmpty()),
	}),
	v.forward(
		v.partialCheck(
			[["password"], ["password-confirmation"]],
			(input) => input["password-confirmation"] === input.password,
			"Passwords don't match.",
		),
		["password-confirmation"],
	),
);
