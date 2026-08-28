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
import { assertAdmin, assertAuthenticated, assertNotImpersonating } from "@/lib/auth/session";
import { resolveAuditSubjectLabel } from "@/lib/data/audit-log";
import { type Transaction, db } from "@/lib/db";
import type { IntlLocale } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import type { MutationResult } from "@/lib/server/create-mutation-action";
import { getUserFacingErrorMessage } from "@/lib/server/get-user-facing-error-message";

export interface CommandContext {
	/** The effective user: whom the mutation is made _as_. */
	user: User | null;
	/** The authenticated account behind `user`; differs only while impersonating. */
	realUser: User | null;
	isImpersonating: boolean;
	locale: IntlLocale;
}

export interface CreateCommandActionOptions<
	TArgs extends ReadonlyArray<unknown>,
	TResult extends MutationResult,
> {
	requireAdmin?: boolean;
	requireAuth?: boolean;
	/**
	 * Refuses the action while impersonating. For anything that mutates the credential behind the
	 * session, which must never be applied to the impersonated user's account. Implies
	 * `requireAuth`.
	 */
	requireNoImpersonation?: boolean;
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
			let realUser: User | null = null;
			let isImpersonating = false;
			if (opts.requireNoImpersonation === true) {
				const session = await assertNotImpersonating();
				user = session.user;
				realUser = session.realUser;
			} else if (opts.requireAdmin === true) {
				const session = await assertAdmin();
				user = session.user;
				realUser = session.realUser;
				isImpersonating = session.isImpersonating;
			} else if (opts.requireAuth === true) {
				const session = await assertAuthenticated();
				user = session.user;
				realUser = session.realUser;
				isImpersonating = session.isImpersonating;
			}

			const locale = await getLocale();
			const ctx: CommandContext = { user, realUser, isImpersonating, locale };

			const result = await db.transaction(async (tx) => {
				const r = await opts.mutate(tx, args, ctx);
				const subjectLabel =
					r.subjectLabel !== undefined
						? r.subjectLabel
						: await resolveAuditSubjectLabel(opts.audit.subjectType, r.subjectId, tx);
				await recordAuditEvent(tx, {
					actorUserId: user?.id,
					impersonatedByUserId: isImpersonating ? realUser?.id : null,
					action: opts.audit.action,
					subjectType: opts.audit.subjectType,
					subjectId: r.subjectId,
					subjectLabel,
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
			const message = getUserFacingErrorMessage(error, {
				documentLinkedToUser: t(
					"A user account is linked to this record. Update that user's linked person or country before deleting it.",
				),
				entitySlugConflict: t("An entity with this slug already exists."),
				uniqueConflict: t("A record with these values already exists."),
				missingRelatedRecord: t(
					"A related record no longer exists. Refresh the page and try again.",
				),
				publishedSlugRename: t(
					"This entity is published, so its address can only be changed by an administrator on the Maintenance page.",
				),
				recordConflict: t("This record conflicts with an existing record."),
				missingDariahEric: t(
					"The DARIAH-EU organisational unit could not be found, so this relation cannot be recorded.",
				),
				missingPairedRelationUnit: t(
					"The governance body this role must also be recorded against could not be found.",
				),
				relationEndBeforeStart: t("The end date must fall after the relation started."),
				relationNotEndable: t(
					"This relation is not one this form can end, or it has already been ended. Refresh the page and try again.",
				),
				relationPeriodOverlap: t(
					"This relation already exists during an overlapping period. Adjust the dates and try again.",
				),
				serviceKpiConflict: t(
					"Both services have a value for the same KPI in the same country report. Remove the duplicate KPIs from that report, then merge.",
				),
				slugTooLong: t("This slug is too long to be used as a web address. Please shorten it."),
				socialMediaKpiConflict: t(
					"Both accounts have a value for the same KPI in the same country report. Remove the duplicate KPIs from that report, then merge.",
				),
				invalidData: t("The submitted data violates a data rule."),
				missingData: t("The submitted data is incomplete."),
			});
			return createActionStateError<TValidationErrors>({
				message: message ?? t("Internal server error."),
			});
		}
	};
}
