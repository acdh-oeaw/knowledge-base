"use client";

import { useExtracted } from "next-intl";
import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

interface LoadingDotsProps {
	size?: "small" | "medium" | "large";
	speed?: "slow" | "normal" | "fast";
	className?: string;
}

export function LoadingDots({
	size = "medium",
	speed = "normal",
	className,
}: Readonly<LoadingDotsProps>): ReactNode {
	const t = useExtracted();

	const sizeClasses = {
		small: "h-1 w-1",
		medium: "h-2 w-2",
		large: "h-3 w-3",
	};

	const speedClasses = {
		slow: "animate-pulse-slow",
		normal: "animate-pulse-normal",
		fast: "animate-pulse-fast",
	};

	return (
		<div
			aria-label={t("Loading")}
			className={twMerge("flex items-center space-x-2", className)}
			role="status"
		>
			{[0, 1, 2].map((i) => (
				<div
					key={i}
					className={twMerge("rounded-full bg-muted-fg", sizeClasses[size], speedClasses[speed])}
					style={{
						animationDelay: `${String(i * 0.15)}s`,
					}}
				/>
			))}
			<span className="sr-only">{t("Loading...")}</span>
		</div>
	);
}
