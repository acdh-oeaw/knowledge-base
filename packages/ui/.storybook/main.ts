import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
	addons: [
		"@storybook/addon-vitest",
		"@storybook/addon-a11y",
		"@chromatic-com/storybook",
		"@storybook/addon-themes",
		"@storybook/addon-docs",
		"storybook-next-intl",
	],
	core: {
		disableWhatsNewNotifications: true,
	},
	framework: "@storybook/react-vite",
	staticDirs: ["../public/"],
	stories: ["../lib/**/*.mdx", "../lib/**/*.stories.@(ts|tsx)"],
	typescript: {
		reactDocgen: "react-docgen-typescript",
		reactDocgenTypescriptOptions: {
			propFilter(prop) {
				return !prop.name.startsWith("aria-");
			},
			shouldExtractLiteralValuesFromEnum: true,
			shouldRemoveUndefinedFromOptional: true,
		},
	},
};

// oxlint-disable-next-line import/no-default-export
export default config;
