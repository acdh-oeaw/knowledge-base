import { type ActionState, isActionStateSuccess } from "@dariah-eric/next-lib/actions";
import cn from "clsx/lite";
import type { ReactNode } from "react";

export interface FormSuccessMessageProps {
	children?: ReactNode | ((state: ActionState) => ReactNode);
	className?: string;
	state: ActionState;
}

export function FormSuccessMessage(props: Readonly<FormSuccessMessageProps>): ReactNode {
	const { children, className, state, ...rest } = props;

	const isSuccessState = isActionStateSuccess(state);

	// TODO: useRenderProps

	return (
		<div
			{...rest}
			aria-atomic={true}
			aria-live="polite"
			className={cn(className, !isSuccessState ? "sr-only" : "text-success-subtle-fg text-sm/6")}
			role="status"
		>
			<div key={state.id}>
				{isSuccessState
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
