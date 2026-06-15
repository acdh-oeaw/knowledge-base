import type { Meta, StoryObj } from "@storybook/react-vite";

import { ProgressCircle } from "./progress-circle";

const meta = {
	title: "Components/ProgressCircle",
	component: ProgressCircle,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	argTypes: {
		value: { control: { type: "range", min: 0, max: 100 } },
	},
	args: {},
} satisfies Meta<typeof ProgressCircle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { value: 60, "aria-label": "Loading" },
	render(props) {
		return <ProgressCircle {...props} />;
	},
};

export const Indeterminate: Story = {
	args: { isIndeterminate: true, "aria-label": "Loading" },
	render(props) {
		return <ProgressCircle {...props} />;
	},
};
