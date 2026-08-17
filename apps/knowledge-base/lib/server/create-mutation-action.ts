import { getFormDataValues } from "@acdh-oeaw/lib";
import type { User } from "@dariah-eric/auth";
import {
	type ActionState,
	createActionStateError,
	createActionStateSuccess,
} from "@dariah-eric/next-lib/actions";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import * as v from "valibot";

import {
	type AuditLogAction,
	getAuditSummaryFromFormData,
	recordAuditEvent,
} from "@/lib/audit/audit-log";
import { type Transaction, db } from "@/lib/db";
import { type IntlLocale, getIntlLanguage } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { type ServerAction, createServerAction } from "@/lib/server/create-server-action";

/**
 * What the mutate function returns. - `auditSummary` is merged into the audit row's summary field.
 * - `successMessage` / `successData` are forwarded to the response when no redirect is set. Set
 * these from inside `mutate` (where the action's own `t = await getExtracted()` binding lives, so
 * the i18n extractor can see the `t(...)` calls). Don't try to pass `t` via the wrapper.
 */
export interface MutationResult<TSuccessData = unknown> {
	subjectId: string;
	auditSummary?: Record<string, unknown>;
	successMessage?: string;
	successData?: TSuccessData;
}

export interface MutationContext {
	user: User | null;
	formData: FormData;
	locale: IntlLocale;
}

export interface AuthenticatedMutationContext extends MutationContext {
	user: User;
}

interface BaseCreateMutationActionOptions<
	TSchema extends v.GenericSchema,
	TSuccessData,
	TContext extends MutationContext,
> {
	schema: TSchema;
	requireAdmin?: boolean;
	requireAuth?: boolean;
	audit: {
		action: AuditLogAction;
		subjectType: string;
	};
	/**
	 * The mutation body. Runs inside a db transaction; the audit row is written in the same
	 * transaction once `mutate` returns. Must return `{ subjectId, auditSummary? }` so the wrapper
	 * can compose the audit entry.
	 */
	mutate: (
		tx: Transaction,
		input: v.InferOutput<TSchema>,
		ctx: TContext,
	) => Promise<MutationResult<TSuccessData>>;
	/** Fire-and-forget work after the transaction commits (sync indexes, dispatch webhooks). */
	postCommit?: (params: {
		result: MutationResult<TSuccessData>;
		input: v.InferOutput<TSchema>;
		ctx: TContext;
	}) => Promise<void> | void;
	/** One or more paths to revalidate (always with "layout" mode). */
	revalidate?: string | ReadonlyArray<string>;
	/** Where to redirect after success. Omit to return a success ActionState instead. */
	redirect?:
		| string
		| ((params: {
				result: MutationResult<TSuccessData>;
				input: v.InferOutput<TSchema>;
				ctx: TContext;
		  }) => string);
	/**
	 * Optional static success message returned when `redirect` is not set. For translated messages
	 * have `mutate` return `successMessage` instead — the i18n extractor needs to see the `t(...)`
	 * call directly in the action source.
	 */
	successMessage?: string;
	/**
	 * Optional pre-mutation hook. Use for checks that require the parsed input + ctx but need to
	 * short-circuit with an error state (e.g., "already exists" guards). Returning an ActionState
	 * stops the wrapper from running mutate; returning undefined lets it proceed.
	 */
	preCheck?: (params: {
		input: v.InferOutput<TSchema>;
		ctx: TContext;
	}) => Promise<ActionState | undefined>;
}

export interface CreateMutationActionOptions<
	TSchema extends v.GenericSchema,
	TSuccessData = unknown,
> extends BaseCreateMutationActionOptions<TSchema, TSuccessData, MutationContext> {
	requireAdmin?: false;
	requireAuth?: false;
}

export interface CreateAuthenticatedMutationActionOptions<
	TSchema extends v.GenericSchema,
	TSuccessData = unknown,
> extends BaseCreateMutationActionOptions<TSchema, TSuccessData, AuthenticatedMutationContext> {
	requireAdmin?: boolean;
	requireAuth: true;
}

export interface CreateAdminMutationActionOptions<
	TSchema extends v.GenericSchema,
	TSuccessData = unknown,
> extends BaseCreateMutationActionOptions<TSchema, TSuccessData, AuthenticatedMutationContext> {
	requireAdmin: true;
	requireAuth?: boolean;
}

export type AnyCreateMutationActionOptions<
	TSchema extends v.GenericSchema,
	TSuccessData = unknown,
> =
	| CreateMutationActionOptions<TSchema, TSuccessData>
	| CreateAuthenticatedMutationActionOptions<TSchema, TSuccessData>
	| CreateAdminMutationActionOptions<TSchema, TSuccessData>;

/**
 * Bundles the standard create/update server-action shape: rate-limit + auth + parse + transaction
 * (mutation + audit) + post-commit fan-out + revalidate + redirect. Per project policy the audit
 * row is written inside the same transaction as the mutation, so a failed audit rolls back the
 * mutation too.
 */
export function createMutationAction<TSchema extends v.GenericSchema, TSuccessData = unknown>(
	opts: AnyCreateMutationActionOptions<TSchema, TSuccessData>,
): ServerAction {
	return createServerAction(
		{ requireAdmin: opts.requireAdmin, requireAuth: opts.requireAuth },
		async (state, formData, { user }) => {
			const locale = await getLocale();
			const t = await getExtracted();

			const parsed = await v.safeParseAsync(opts.schema, getFormDataValues(formData), {
				lang: getIntlLanguage(locale),
			});

			if (!parsed.success) {
				const errors = v.flatten<TSchema>(parsed.issues);
				return createActionStateError({
					message: errors.root ?? t("Invalid or missing fields."),
					validationErrors: errors.nested,
				});
			}

			const input = parsed.output;
			const ctx = { user, formData, locale } as MutationContext & AuthenticatedMutationContext;

			if (opts.preCheck != null) {
				const preCheckResult = await opts.preCheck({ input, ctx });
				if (preCheckResult != null) {
					return preCheckResult;
				}
			}

			const result = await db.transaction(async (tx) => {
				const mutationResult = await opts.mutate(tx, input, ctx);
				await recordAuditEvent(tx, {
					actorUserId: user?.id,
					action: opts.audit.action,
					subjectType: opts.audit.subjectType,
					subjectId: mutationResult.subjectId,
					summary: {
						...getAuditSummaryFromFormData(formData),
						...mutationResult.auditSummary,
					},
				});
				return mutationResult;
			});

			if (opts.postCommit != null) {
				const postCommit = opts.postCommit;
				after(async () => {
					await postCommit({ result, input, ctx });
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
					typeof opts.redirect === "string" ? opts.redirect : opts.redirect({ result, input, ctx });
				redirect({ href, locale });
			}

			return createActionStateSuccess({
				message: result.successMessage ?? opts.successMessage,
				data: result.successData,
			});
		},
	);
}
