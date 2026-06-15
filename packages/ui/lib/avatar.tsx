import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export interface AvatarProps {
	src?: string | null;
	initials?: string;
	alt?: string;
	className?: string;
	isSquare?: boolean;
	size?:
		| "xs"
		| "sm"
		| "md"
		| "lg"
		| "xl"
		| "2xl"
		| "3xl"
		| "4xl"
		| "5xl"
		| "6xl"
		| "7xl"
		| "8xl"
		| "9xl";
}

export function Avatar({
	src = null,
	isSquare = false,
	size = "md",
	initials,
	alt = "",
	className,
	...props
}: Readonly<AvatarProps & React.ComponentPropsWithoutRef<"span">>): ReactNode {
	return (
		<span
			data-slot="avatar"
			{...props}
			className={twMerge(
				"inline-grid block-(--avatar-size) inline-(--avatar-size) shrink-0 align-middle outline-1 outline-fg/(--ring-opacity) -outline-offset-1 [--avatar-radius:20%] [--ring-opacity:20%] *:col-start-1 *:row-start-1 *:block-(--avatar-size) *:inline-(--avatar-size)",
				size === "xs" && "[--avatar-size:--spacing(5)]",
				size === "sm" && "[--avatar-size:--spacing(6)]",
				size === "md" && "[--avatar-size:--spacing(8)]",
				size === "lg" && "[--avatar-size:--spacing(10)]",
				size === "xl" && "[--avatar-size:--spacing(12)]",
				size === "2xl" && "[--avatar-size:--spacing(14)]",
				size === "3xl" && "[--avatar-size:--spacing(16)]",
				size === "4xl" && "[--avatar-size:--spacing(20)]",
				size === "5xl" && "[--avatar-size:--spacing(24)]",
				size === "6xl" && "[--avatar-size:--spacing(28)]",
				size === "7xl" && "[--avatar-size:--spacing(32)]",
				size === "8xl" && "[--avatar-size:--spacing(36)]",
				size === "9xl" && "[--avatar-size:--spacing(32)]",
				isSquare
					? "rounded-(--avatar-radius) *:rounded-(--avatar-radius)"
					: "rounded-full *:rounded-full",
				className,
			)}
		>
			{initials !== undefined && (
				<svg
					aria-hidden={alt ? undefined : "true"}
					className="block-full inline-full select-none fill-current p-[5%] text-base text-[48px] uppercase"
					viewBox="0 0 100 100"
				>
					{alt && <title>{alt}</title>}
					<text
						alignmentBaseline="middle"
						dominantBaseline="middle"
						dy=".125em"
						textAnchor="middle"
						x="50%"
						y="50%"
					>
						{initials}
					</text>
				</svg>
			)}
			{src !== null && (
				<img alt={alt} className="block-full inline-full object-cover object-center" src={src} />
			)}
		</span>
	);
}
