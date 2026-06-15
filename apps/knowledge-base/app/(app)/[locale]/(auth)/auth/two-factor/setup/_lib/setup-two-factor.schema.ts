import * as v from "valibot";

import { auth } from "@/lib/auth";

export const SetupTwoFactorActionInputSchema = v.object({
	code: v.pipe(v.string(), v.nonEmpty()),
	key: v.pipe(v.string(), v.nonEmpty()),
});

export const TotpKeySchema = v.pipe(
	v.string(),
	v.length(28),
	v.transform((input) => Buffer.from(auth.decodeBase64(input))),
	v.check((key) => key.byteLength === 20),
);
