import type { ReactNode } from "react";
import { type VariantProps, tv } from "tailwind-variants";

export const badgeStyles = tv({
	base: [
		"inline-flex items-center gap-x-1.5 py-0.5 font-medium text-xs/5 forced-colors:outline",
		"inset-ring inset-ring-(--badge-ring) bg-(--badge-bg) text-(--badge-fg) [--badge-ring:transparent]",
		"group-hover:bg-(--badge-overlay) group-focus:bg-(--badge-overlay)",
		"*:data-[slot=icon]:block-3 *:data-[slot=icon]:inline-3 *:data-[slot=icon]:shrink-0",
		"duration-200",
	],
	variants: {
		intent: {
			primary:
				"[--badge-bg:var(--color-primary-subtle)] [--badge-fg:var(--color-primary-subtle-fg)] [--badge-overlay:var(--color-primary)]/20",
			secondary:
				"[--badge-bg:var(--color-secondary)] [--badge-fg:var(--color-secondary-fg)] [--badge-overlay:var(--color-muted-fg)]/25",
			success:
				"[--badge-bg:var(--color-success-subtle)] [--badge-fg:var(--color-success-subtle-fg)] [--badge-overlay:var(--color-success)]/20",
			info: "[--badge-bg:var(--color-info-subtle)] [--badge-fg:var(--color-info-subtle-fg)] [--badge-overlay:var(--color-sky-500)]/20",
			emerald:
				"[--badge-bg:var(--color-emerald-subtle)] [--badge-fg:var(--color-emerald-subtle-fg)] [--badge-overlay:var(--color-emerald)]/20",
			amber:
				"[--badge-bg:var(--color-amber-subtle)] [--badge-fg:var(--color-amber-subtle-fg)] [--badge-overlay:var(--color-amber)]/20",
			rose: "[--badge-bg:var(--color-rose-subtle)] [--badge-fg:var(--color-rose-subtle-fg)] [--badge-overlay:var(--color-rose)]/20",
			slate:
				"[--badge-bg:var(--color-slate-subtle)] [--badge-fg:var(--color-slate-subtle-fg)] [--badge-overlay:var(--color-slate)]/20",
			violet:
				"[--badge-bg:var(--color-violet-subtle)] [--badge-fg:var(--color-violet-subtle-fg)] [--badge-overlay:var(--color-violet)]/20",
			pink: "[--badge-bg:var(--color-pink-subtle)] [--badge-fg:var(--color-pink-subtle-fg)] [--badge-overlay:var(--color-pink)]/20",
			warning:
				"[--badge-bg:var(--color-warning-subtle)] [--badge-fg:var(--color-warning-subtle-fg)] [--badge-overlay:var(--color-warning)]/20",
			danger:
				"[--badge-bg:var(--color-danger-subtle)] [--badge-fg:var(--color-danger-subtle-fg)] [--badge-overlay:var(--color-danger)]/20",
			outline: "[--badge-overlay:var(--color-secondary)]/20 [--badge-ring:var(--color-border)]",
		},
		isCircle: {
			true: "rounded-full px-2",
			false: "rounded-sm px-1.5",
		},
	},
	defaultVariants: {
		intent: "primary",
		isCircle: true,
	},
});

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeStyles> {
	className?: string;
	children: React.ReactNode;
}

export function Badge({
	children,
	intent,
	isCircle = true,
	className,
	...props
}: Readonly<BadgeProps>): ReactNode {
	return (
		<span {...props} className={badgeStyles({ intent, isCircle, className })}>
			{children}
		</span>
	);
}
