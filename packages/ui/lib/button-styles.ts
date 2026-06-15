import { tv } from "tailwind-variants";

export const buttonStyles = tv({
	base: [
		"[--btn-border:var(--color-fg)]/15 [--btn-icon-active:var(--btn-fg)] [--btn-outline:var(--btn-bg)] [--btn-radius:calc(var(--radius-lg)-1px)] [--btn-ring:var(--btn-bg)]/20",
		"bg-(--btn-bg) text-(--btn-fg) outline-(--btn-outline) ring-(--btn-ring) hover:bg-(--btn-overlay)",
		"relative isolate inline-flex items-center justify-center border border-(--btn-border) font-medium hover:no-underline",
		"focus:outline-0 focus-visible:outline focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-offset-3 focus-visible:ring-offset-bg",
		"forced-colors:[--btn-icon:ButtonText] forced-colors:hover:[--btn-icon:ButtonText] *:data-[slot=icon]:-mx-0.5 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:self-center *:data-[slot=icon]:text-(--btn-icon) focus-visible:*:data-[slot=icon]:text-(--btn-icon-active)/80 hover:*:data-[slot=icon]:text-(--btn-icon-active)/90",
		"*:data-[slot=loader]:-mx-0.5 *:data-[slot=loader]:shrink-0 *:data-[slot=loader]:self-center *:data-[slot=loader]:text-(--btn-icon)",
		"pending:opacity-50 disabled:opacity-50 forced-colors:disabled:text-[GrayText]",
		"*:data-[slot=color-swatch]:-mx-0.5 *:data-[slot=color-swatch]:shrink-0 *:data-[slot=color-swatch]:self-center *:data-[slot=color-swatch]:[--color-swatch-size:--spacing(5)]",
	],
	variants: {
		intent: {
			primary:
				"[--btn-bg:var(--color-primary)] [--btn-fg:var(--color-primary-fg)] [--btn-icon-active:var(--primary-fg)]/80 [--btn-icon:var(--primary-fg)]/60 [--btn-overlay:color-mix(in_oklab,var(--color-primary-fg)_10%,var(--color-primary)_90%)]",
			secondary:
				"[--btn-bg:var(--color-secondary)] [--btn-fg:var(--color-secondary-fg)] [--btn-icon:var(--color-muted-fg)] [--btn-outline:var(--color-secondary-fg)] [--btn-overlay:color-mix(in_oklab,var(--color-secondary-fg)_10%,var(--color-secondary)_90%)] [--btn-ring:var(--color-muted-fg)]/20",
			warning:
				"[--btn-bg:var(--color-warning)] [--btn-fg:var(--color-warning-fg)] [--btn-icon:var(--color-warning-fg)]/60 [--btn-overlay:color-mix(in_oklab,var(--color-white)_10%,var(--color-warning)_90%)]",
			danger:
				"[--btn-bg:var(--color-danger)] [--btn-fg:var(--color-danger-fg)] [--btn-icon:color-mix(in_oklab,var(--color-danger-fg)_60%,var(--danger)_40%)] [--btn-overlay:color-mix(in_oklab,var(--color-white)_10%,var(--color-danger)_90%)]",
			outline:
				"border-border [--btn-bg:transparent] [--btn-icon:var(--color-muted-fg)] [--btn-outline:var(--color-ring)] [--btn-overlay:var(--color-secondary)] [--btn-ring:var(--color-ring)]/20",
			plain:
				"border-transparent [--btn-bg:transparent] [--btn-icon:var(--color-muted-fg)] [--btn-outline:var(--color-ring)] [--btn-overlay:var(--color-secondary)] [--btn-ring:var(--color-ring)]/20",
		},
		size: {
			xs: [
				"min-block-8 gap-x-1.5 px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-sm sm:min-block-7 sm:px-2 sm:py-[calc(--spacing(1.5)-1px)] sm:text-xs/4",
				"*:data-[slot=icon]:-mx-px *:data-[slot=icon]:block-3.5 *:data-[slot=icon]:inline-3.5 sm:*:data-[slot=icon]:block-3 sm:*:data-[slot=icon]:inline-3",
				"*:data-[slot=loader]:-mx-px *:data-[slot=loader]:block-3.5 *:data-[slot=loader]:inline-3.5 sm:*:data-[slot=loader]:block-3 sm:*:data-[slot=loader]:inline-3",
			],
			sm: [
				"min-block-9 gap-x-1.5 px-3 py-[calc(--spacing(2)-1px)] sm:min-block-8 sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/5",
				"*:data-[slot=icon]:block-4.5 *:data-[slot=icon]:inline-4.5 sm:*:data-[slot=icon]:block-4 sm:*:data-[slot=icon]:inline-4",
				"*:data-[slot=loader]:block-4.5 *:data-[slot=loader]:inline-4.5 sm:*:data-[slot=loader]:block-4 sm:*:data-[slot=loader]:inline-4",
			],
			md: [
				"min-block-10 gap-x-2 px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:min-block-9 sm:px-3 sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/6",
				"*:data-[slot=icon]:block-5 *:data-[slot=icon]:inline-5 sm:*:data-[slot=icon]:block-4 sm:*:data-[slot=icon]:inline-4",
				"*:data-[slot=loader]:block-5 *:data-[slot=loader]:inline-5 sm:*:data-[slot=loader]:block-4 sm:*:data-[slot=loader]:inline-4",
			],
			lg: [
				"min-block-10 gap-x-2 px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(3)-1px)] sm:min-block-9 sm:px-3 sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/7",
				"*:data-[slot=icon]:block-5 *:data-[slot=icon]:inline-5 sm:*:data-[slot=icon]:block-4.5 sm:*:data-[slot=icon]:inline-4.5",
				"*:data-[slot=loader]:block-5 *:data-[slot=loader]:inline-5 sm:*:data-[slot=loader]:block-4.5 sm:*:data-[slot=loader]:inline-4.5",
			],
			"sq-xs": [
				"touch-area block-8 inline-8 sm:block-7 sm:inline-7",
				"*:data-[slot=icon]:block-3.5 *:data-[slot=icon]:inline-3.5 sm:*:data-[slot=icon]:block-3 sm:*:data-[slot=icon]:inline-3",
				"*:data-[slot=loader]:block-3.5 *:data-[slot=loader]:inline-3.5 sm:*:data-[slot=loader]:block-3 sm:*:data-[slot=loader]:inline-3",
			],
			"sq-sm": [
				"touch-area block-10 inline-10 sm:block-8 sm:inline-8",
				"*:data-[slot=icon]:block-4.5 *:data-[slot=icon]:inline-4.5 sm:*:data-[slot=icon]:block-4 sm:*:data-[slot=icon]:inline-4",
				"*:data-[slot=loader]:block-4.5 *:data-[slot=loader]:inline-4.5 sm:*:data-[slot=loader]:block-4 sm:*:data-[slot=loader]:inline-4",
			],
			"sq-md": [
				"touch-area block-11 inline-11 sm:block-9 sm:inline-9",
				"*:data-[slot=icon]:block-5 *:data-[slot=icon]:inline-5 sm:*:data-[slot=icon]:block-4.5 sm:*:data-[slot=icon]:inline-4.5",
				"*:data-[slot=loader]:block-5 *:data-[slot=loader]:inline-5 sm:*:data-[slot=loader]:block-4.5 sm:*:data-[slot=loader]:inline-4.5",
			],
			"sq-lg": [
				"touch-area block-12 inline-12 sm:block-10 sm:inline-10",
				"*:data-[slot=icon]:block-6 *:data-[slot=icon]:inline-6 sm:*:data-[slot=icon]:block-5 sm:*:data-[slot=icon]:inline-5",
				"*:data-[slot=loader]:block-6 *:data-[slot=loader]:inline-6 sm:*:data-[slot=loader]:block-5 sm:*:data-[slot=loader]:inline-5",
			],
		},

		isCircle: {
			true: "rounded-full",
			false: "rounded-lg",
		},
	},
	defaultVariants: {
		intent: "primary",
		size: "md",
		isCircle: false,
	},
});
