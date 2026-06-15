import type { Meta, StoryObj } from "@storybook/react-vite";

import { Separator } from "./separator";

const meta = {
	title: "Components/Separator",
	component: Separator,
	tags: ["autodocs"],
	argTypes: {
		orientation: {
			control: "select",
			options: ["horizontal", "vertical"],
		},
	},
	args: {},
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { orientation: "horizontal" },
	render(props) {
		return (
			<div className="inline-64">
				<Separator {...props} />
			</div>
		);
	},
};

export const Vertical: Story = {
	args: { orientation: "vertical" },
	render(props) {
		return (
			<div className="flex block-8 items-center gap-4">
				<span>{"Left"}</span>
				<Separator {...props} />
				<span>{"Right"}</span>
			</div>
		);
	},
};
