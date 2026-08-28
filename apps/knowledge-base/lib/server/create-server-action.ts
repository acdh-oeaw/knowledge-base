import { log } from "@acdh-oeaw/lib";
import type { User } from "@dariah-eric/auth";
import {
	type ActionState,
	type ValidationErrors,
	createActionStateError,
} from "@dariah-eric/next-lib/actions";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { getExtracted } from "next-intl/server";
import { headers } from "next/headers";
import { unstable_rethrow as rethrow } from "next/navigation";

import { assertAdmin, assertAuthenticated, assertNotImpersonating } from "@/lib/auth/session";
import { getUserFacingErrorMessage } from "@/lib/server/get-user-facing-error-message";

export interface ServerActionContext {
	/**
	 * The effective user -- whom the action is performed _as_, which is the impersonated user while
	 * impersonating. Non-null when the wrapper was configured with `requireAdmin`, `requireAuth` or
	 * `requireNoImpersonation`; null otherwise. Handlers that opted into auth can dereference without
	 * a check.
	 */
	user: User | null;
	/** The account that actually authenticated; differs from `user` only while impersonating. */
	realUser: User | null;
	isImpersonating: boolean;
}

export type ServerAction<TData = unknown, TValidationErrors extends object = ValidationErrors> = (
	state: ActionState<TData, TValidationErrors>,
	formData: FormData,
) => Promise<ActionState<TData, TValidationErrors>>;

export type ServerActionHandler<
	TData = unknown,
	TValidationErrors extends object = ValidationErrors,
> = (
	state: ActionState<TData, TValidationErrors>,
	formData: FormData,
	ctx: ServerActionContext,
) => Promise<ActionState<TData, TValidationErrors>>;

export interface CreateServerActionOptions {
	/** Asserts that the caller is an admin; redirects to /dashboard otherwise. */
	requireAdmin?: boolean;
	/** Asserts that the caller has a valid authenticated session. Implied by requireAdmin. */
	requireAuth?: boolean;
	/**
	 * Refuses the action while impersonating. For anything that mutates the credential behind the
	 * session, which must never be applied to the impersonated user's account. Implies
	 * `requireAuth`.
	 */
	requireNoImpersonation?: boolean;
}

/**
 * Test-only failure injection: if `E2E_FAILURE_INJECTION` is set in the server environment AND the
 * incoming request carries the `x-e2e-force-failure` header, the wrapped action throws so the
 * wrapper's catch returns an error state. The env var is set by Playwright's webServer config so it
 * cannot accidentally enable this in production.
 */
async function shouldInjectFailure(): Promise<boolean> {
	// oxlint-disable-next-line node/no-process-env
	if (process.env.E2E_FAILURE_INJECTION !== "1") {
		return false;
	}

	const headerStore = await headers();
	return headerStore.get("x-e2e-force-failure") != null;
}

export function createServerAction<
	TData = unknown,
	TValidationErrors extends object = ValidationErrors,
>(handler: ServerActionHandler<TData, TValidationErrors>): ServerAction<TData, TValidationErrors>;
export function createServerAction<
	TData = unknown,
	TValidationErrors extends object = ValidationErrors,
>(
	options: CreateServerActionOptions,
	handler: ServerActionHandler<TData, TValidationErrors>,
): ServerAction<TData, TValidationErrors>;
export function createServerAction<
	TData = unknown,
	TValidationErrors extends object = ValidationErrors,
>(
	optionsOrHandler: CreateServerActionOptions | ServerActionHandler<TData, TValidationErrors>,
	maybeHandler?: ServerActionHandler<TData, TValidationErrors>,
): ServerAction<TData, TValidationErrors> {
	const options: CreateServerActionOptions =
		typeof optionsOrHandler === "function" ? {} : optionsOrHandler;
	const handler: ServerActionHandler<TData, TValidationErrors> =
		typeof optionsOrHandler === "function" ? optionsOrHandler : maybeHandler!;

	return async (state: ActionState<TData, TValidationErrors>, formData: FormData) => {
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
			if (options.requireNoImpersonation === true) {
				const session = await assertNotImpersonating();
				user = session.user;
				realUser = session.realUser;
			} else if (options.requireAdmin === true) {
				const session = await assertAdmin();
				user = session.user;
				realUser = session.realUser;
				isImpersonating = session.isImpersonating;
			} else if (options.requireAuth === true) {
				const session = await assertAuthenticated();
				user = session.user;
				realUser = session.realUser;
				isImpersonating = session.isImpersonating;
			}

			return await handler(state, formData, { user, realUser, isImpersonating });
		} catch (error) {
			rethrow(error);

			log.error(error);
			const message = getUserFacingErrorMessage(error, {
				documentLinkedToUser: t(
					"A user account is linked to this record. Update that user's linked person or country before deleting it.",
				),
				entitySlugConflict: t("An entity with this slug already exists."),
				uniqueConflict: t("A record with these values already exists."),
				missingDariahEric: t(
					"The DARIAH-EU organisational unit could not be found, so this relation cannot be recorded.",
				),
				missingPairedRelationUnit: t(
					"The governance body this role must also be recorded against could not be found.",
				),
				relationPeriodOverlap: t(
					"This relation already exists during an overlapping period. Adjust the dates and try again.",
				),
				relationEndBeforeStart: t("The end date must fall after the relation started."),
				relationNotEndable: t(
					"This relation is not one this form can end, or it has already been ended. Refresh the page and try again.",
				),
				missingRelatedRecord: t(
					"A related record no longer exists. Refresh the page and try again.",
				),
				publishedSlugRename: t(
					"This entity is published, so its address can only be changed by an administrator on the Maintenance page.",
				),
				recordConflict: t("This record conflicts with an existing record."),
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
				formData,
				message: message ?? t("Internal server error."),
			});
		}
	};
}
