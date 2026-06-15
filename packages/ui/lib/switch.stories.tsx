import type { Meta, StoryObj } from "@storybook/react-vite";

import { Switch } from "./switch";

const meta = {
	title: "Components/Switch",
	component: Switch,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { children: "Enable notifications" },
	render(props) {
		const { children, ...rest } = props;
		return <Switch {...rest}>{children}</Switch>;
	},
};

export const Selected: Story = {
	args: { children: "Dark mode", defaultSelected: true },
	render(props) {
		const { children, ...rest } = props;
		return <Switch {...rest}>{children}</Switch>;
	},
};

export const Disabled: Story = {
	args: { children: "Auto-save", isDisabled: true },
	render(props) {
		const { children, ...rest } = props;
		return <Switch {...rest}>{children}</Switch>;
	},
};
