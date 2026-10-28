import type { ReactNode } from "react";

export interface LogoProps {
	className?: string;
}

export function Logo(props: Readonly<LogoProps>): ReactNode {
	const { className } = props;

	return (
		<svg
			aria-hidden={true}
			className={className}
			stroke="currentColor"
			viewBox="0 0 512 512"
			height={16}
			width={16}
		>
			<g fill="none" strokeWidth="18">
				<line x1="256" y1="192" x2="256" y2="118" />
				<line x1="311.4" y1="224" x2="375.5" y2="187" />
				<line x1="311.4" y1="288" x2="375.5" y2="325" />
				<line x1="256" y1="320" x2="256" y2="394" />
				<line x1="200.6" y1="288" x2="136.5" y2="325" />
				<line x1="200.6" y1="224" x2="136.5" y2="187" />
				<circle cx="256" cy="256" r="64" />
				<circle cx="256" cy="88" r="30" />
				<circle cx="401.5" cy="172" r="30" />
				<circle cx="401.5" cy="340" r="30" />
				<circle cx="256" cy="424" r="30" />
				<circle cx="110.5" cy="340" r="30" />
				<circle cx="110.5" cy="172" r="30" />
			</g>
		</svg>
	);
}
