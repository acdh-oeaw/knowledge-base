import { type ActionState, isActionStateError } from "@dariah-eric/next-lib/actions";
import cn from "clsx/lite";
import type { ReactNode } from "react";

export interface FormErrorMessageProps {
	children?: ReactNode | ((state: ActionState) => ReactNode);
	className?: string;
	state: ActionState;
}

export function FormErrorMessage(props: Readonly<FormErrorMessageProps>): ReactNode {
	const { children, className, state, ...rest } = props;

	const isErrorState = isActionStateError(state);

	return (
		<div
			{...rest}
			aria-atomic={true}
			aria-live="assertive"
			className={cn(className, !isErrorState ? "sr-only" : "text-danger-subtle-fg text-sm/6")}
			role="alert"
		>
			<div key={state.id}>
				{isErrorState
					? children != null
						? typeof children === "function"
							? children(state)
							: children
						: state.message
					: null}
			</div>
		</div>
	);
}
