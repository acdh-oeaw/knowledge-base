declare module "react" {
	interface CSSProperties {
		// oxlint-disable-next-line typescript/consistent-indexed-object-style
		[key: `--${string}`]: number | string | null;
	}
}

// oxlint-disable-next-line unicorn/require-module-specifiers
export {};
