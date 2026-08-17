import { log } from "@acdh-oeaw/lib";
import type { User } from "@dariah-eric/auth";
import {
	type ActionState,
	type ValidationErrors,
	createActionStateError,
	createActionStateSuccess,
} from "@dariah-eric/next-lib/actions";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { unstable_rethrow as rethrow } from "next/navigation";
import { after } from "next/server";

import { type AuditLogAction, recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin, assertAuthenticated } from "@/lib/auth/session";
import { type Transaction, db } from "@/lib/db";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import type { MutationResult } from "@/lib/server/create-mutation-action";

export interface CommandContext {
	user: User | null;
	locale: IntlLocale;
}

export interface CreateCommandActionOptions<
	TArgs extends ReadonlyArray<unknown>,
	TResult extends MutationResult,
> {
	requireAdmin?: boolean;
	requireAuth?: boolean;
	audit: {
		action: AuditLogAction;
		subjectType: string;
	};
	/** Runs inside a db transaction. The audit row is written in the same transaction. */
	mutate: (tx: Transaction, args: TArgs, ctx: CommandContext) => Promise<TResult>;
	/** Fire-and-forget work after the transaction commits. */
	postCommit?: (params: {
		result: TResult;
		args: TArgs;
		ctx: CommandContext;
	}) => Promise<void> | void;
	revalidate?: string | ReadonlyArray<string>;
	redirect?: string | ((params: { result: TResult; args: TArgs; ctx: CommandContext }) => string);
}

async function shouldInjectFailure(): Promise<boolean> {
	// oxlint-disable-next-line node/no-process-env
	if (process.env.E2E_FAILURE_INJECTION !== "1") {
		return false;
	}
	const headerStore = await headers();
	return headerStore.get("x-e2e-force-failure") != null;
}

/**
 * Bundles the standard "command" server-action shape: rate-limit + auth + transaction (mutation +
 * audit) + post-commit fan-out + revalidate + redirect/return. Use for delete/publish/discard-style
 * actions that take a positional id argument rather than form data.
 *
 * Returns an ActionState: callers should check via `isActionStateError` and handle accordingly.
 * Internal errors (logged) come back as a generic "Internal server error" action state.
 */
export function createCommandAction<
	TArgs extends ReadonlyArray<unknown>,
	TResult extends MutationResult,
	TValidationErrors extends object = ValidationErrors,
>(
	opts: CreateCommandActionOptions<TArgs, TResult>,
): (...args: TArgs) => Promise<ActionState<unknown, TValidationErrors>> {
	return async (...args: TArgs) => {
		const t = await getExtracted();

		try {
			if (await shouldInjectFailure()) {
				throw new Error("e2e: forced failure via x-e2e-force-failure header");
			}

			if (!(await globalPostRequestRateLimit())) {
				return createActionStateError<TValidationErrors>({ message: t("Too many requests.") });
			}

			let user: User | null = null;
			if (opts.requireAdmin === true) {
				const session = await assertAdmin();
				user = session.user;
			} else if (opts.requireAuth === true) {
				const session = await assertAuthenticated();
				user = session.user;
			}

			const locale = await getLocale();
			const ctx: CommandContext = { user, locale };

			const result = await db.transaction(async (tx) => {
				const r = await opts.mutate(tx, args, ctx);
				await recordAuditEvent(tx, {
					actorUserId: user?.id,
					action: opts.audit.action,
					subjectType: opts.audit.subjectType,
					subjectId: r.subjectId,
					summary: r.auditSummary ?? {},
				});
				return r;
			});

			if (opts.postCommit != null) {
				const postCommit = opts.postCommit;
				after(async () => {
					await postCommit({ result, args, ctx });
				});
			}

			if (opts.revalidate != null) {
				const paths = typeof opts.revalidate === "string" ? [opts.revalidate] : opts.revalidate;
				for (const path of paths) {
					revalidatePath(path, "layout");
				}
			}

			if (opts.redirect != null) {
				const href =
					typeof opts.redirect === "string" ? opts.redirect : opts.redirect({ result, args, ctx });
				redirect({ href, locale });
			}

			return createActionStateSuccess({});
		} catch (error) {
			rethrow(error);
			log.error(error);
			return createActionStateError<TValidationErrors>({
				message: t("Internal server error."),
			});
		}
	};
}
