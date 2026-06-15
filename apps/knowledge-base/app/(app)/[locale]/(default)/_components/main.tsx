import type { ReactNode } from "react";

import { Main as BaseMain, type MainProps as BaseMainProps } from "@/components/main";

export const mainContentId = "main-content";

interface MainProps extends Omit<BaseMainProps, "id"> {
	children: ReactNode;
}

export function Main(props: Readonly<MainProps>): ReactNode {
	const { children, ...rest } = props;

	return (
		<BaseMain {...rest} id={mainContentId}>
			{children}
		</BaseMain>
	);
}
