import type { Meta, StoryObj } from "@storybook/react-vite";

import { Loader } from "./loader";

const meta = {
	title: "Components/Loader",
	component: Loader,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	argTypes: {
		variant: {
			control: "select",
			options: ["spin", "ring"],
		},
	},
	args: {},
} satisfies Meta<typeof Loader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { variant: "spin" },
	render(props) {
		return <Loader {...props} />;
	},
};

export const Ring: Story = {
	args: { variant: "ring" },
	render(props) {
		return <Loader {...props} />;
	},
};
