"use client";

import {
	type ActionState,
	isActionStateError,
	isActionStateSuccess,
} from "@dariah-eric/next-lib/actions";
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { FormErrorMessage } from "@/lib/form-error-message";
import { FormSuccessMessage } from "@/lib/form-success-message";

export interface FormStatusProps {
	className?: string;
	state: ActionState;
}

export function FormStatus(props: Readonly<FormStatusProps>): ReactNode {
	const { className, state } = props;

	return (
		<Fragment>
			<FormErrorMessage className={className} state={state}>
				{(state) => {
					if (!isActionStateError(state)) {
						return null;
					}

					return (
						<span className="flex items-center gap-x-2">
							<AlertTriangleIcon aria-hidden={true} className="block-5 inline-5" />
							{state.message}
						</span>
					);
				}}
			</FormErrorMessage>
			<FormSuccessMessage className={className} state={state}>
				{(state) => {
					if (!isActionStateSuccess(state) || state.message == null) {
						return null;
					}

					return (
						<span className="flex items-center gap-x-2">
							<CheckCircle2Icon aria-hidden={true} className="block-5 inline-5" />
							{state.message}
						</span>
					);
				}}
			</FormSuccessMessage>
		</Fragment>
	);
}
