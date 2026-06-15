"use client";

import { type ComponentProps, type ReactNode, createContext, use } from "react";
import {
	Meter as PrimitiveMeter,
	type MeterProps as PrimitiveMeterProps,
	type MeterRenderProps as PrimitiveMeterRenderProps,
} from "react-aria-components";
import { twMerge } from "tailwind-merge";

import { cx } from "@/lib/primitive";

interface MeterRenderProps extends PrimitiveMeterRenderProps {
	color?: string;
}

const MeterContext = createContext<MeterRenderProps | null>(null);

interface MeterProps extends PrimitiveMeterProps, Pick<MeterRenderProps, "color"> {}

export function Meter(props: Readonly<MeterProps>): ReactNode {
	const { className, children, color, ...rest } = props;

	return (
		<PrimitiveMeter
			data-slot="meter"
			{...rest}
			className={cx(
				"inline-full",
				"[&>[data-slot=meter-header]+[data-slot=meter-track]]:mbs-2",
				"[&>[data-slot=meter-header]+[data-slot=meter-track]]:mbs-2",
				"[&>[data-slot=meter-header]+[slot='description']]:mbs-1",
				"[&>[slot='description']+[data-slot=meter-track]]:mbs-2",
				"[&>[data-slot=meter-track]+[slot=description]]:mbs-2",
				"[&>[data-slot=meter-track]+[slot=errorMessage]]:mbs-2",
				"*:data-[slot=meter-header]:font-medium",
				className,
			)}
		>
			{(values) => (
				<MeterContext value={{ ...values, color }}>
					{typeof children === "function" ? children(values) : children}
				</MeterContext>
			)}
		</PrimitiveMeter>
	);
}

export function MeterTrack(props: Readonly<ComponentProps<"div">>): ReactNode {
	const { className, ...rest } = props;

	const { percentage, color } = use(MeterContext)!;

	return (
		<div
			className={twMerge(
				"[--meter-height:--spacing(1.5)]",
				"relative block-(--meter-height) inline-full overflow-hidden rounded-full bg-secondary outline outline-transparent -outline-offset-1",
				className,
			)}
			data-slot="meter-track"
			{...rest}
		>
			<div
				className="absolute inset-bs-0 inset-s-0 block-full rounded-full transition-[width] duration-200 ease-linear will-change-[width] motion-reduce:transition-none forced-colors:bg-[Highlight]"
				data-slot="meter-fill"
				style={{
					width: `${String(percentage)}%`,
					backgroundColor: color ?? getMeterColor(percentage),
				}}
			/>
		</div>
	);
}

export interface MeterValueProps extends Omit<ComponentProps<"span">, "children"> {}

export function MeterValue(props: Readonly<MeterValueProps>): ReactNode {
	const { className, ...rest } = props;

	const { valueText } = use(MeterContext)!;

	return (
		<span
			className={twMerge("text-base/6 sm:text-sm/6", className)}
			data-slot="meter-value"
			{...rest}
		>
			{valueText}
		</span>
	);
}

export interface MeterHeaderProps extends ComponentProps<"div"> {}

export function MeterHeader(props: Readonly<MeterHeaderProps>): ReactNode {
	const { className, ...rest } = props;

	return (
		<div
			className={twMerge("flex items-center justify-between", className)}
			data-slot="meter-header"
			{...rest}
		/>
	);
}

function getMeterColor(value: number): string {
	if (value < 50) {
		return "var(--color-success)";
	}
	if (value < 80) {
		return "var(--color-warning)";
	}
	return "var(--color-danger)";
}
