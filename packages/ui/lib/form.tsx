"use client";

import {
	type ActionState,
	type ValidationErrors,
	isActionStateError,
} from "@dariah-eric/next-lib/actions";
import type { ReactNode } from "react";
import { Form as AriaForm, type FormProps as AriaFormProps } from "react-aria-components";

export interface FormProps<
	TData = unknown,
	TValidationErrors extends object = ValidationErrors,
> extends AriaFormProps {
	children: ReactNode;
	state: ActionState<TData, TValidationErrors>;
}

export function Form<TData = unknown, TValidationErrors extends object = ValidationErrors>(
	props: Readonly<FormProps<TData, TValidationErrors>>,
): ReactNode {
	const { children, state, ...rest } = props;

	return (
		<AriaForm
			validationErrors={
				isActionStateError(state)
					? (state.validationErrors as AriaFormProps["validationErrors"])
					: undefined
			}
			{...rest}
		>
			{children}
		</AriaForm>
	);
}
