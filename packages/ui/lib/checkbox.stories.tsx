import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox } from "./checkbox";

const meta = {
	title: "Components/Checkbox",
	component: Checkbox,
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { children: "lorem ipsum" },
	render(props) {
		const { children, ...rest } = props;
		return <Checkbox {...rest}>{children}</Checkbox>;
	},
};

export const WithDescription: Story = {
	args: {
		children: "Monitoring",
		description: "Ping the service endpoint once per hour.",
	},
	render(props) {
		const { children, ...rest } = props;
		return <Checkbox {...rest}>{children}</Checkbox>;
	},
};

export const Indeterminate: Story = {
	args: { children: "lorem ipsum", isIndeterminate: true },
	render(props) {
		const { children, ...rest } = props;
		return <Checkbox {...rest}>{children}</Checkbox>;
	},
};
