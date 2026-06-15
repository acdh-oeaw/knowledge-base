import type { Meta, StoryObj } from "@storybook/react-vite";

import { DateInput } from "./date-field";
import { Label } from "./field";
import { TimeField } from "./time-field";

const meta = {
	title: "Components/TimeField",
	component: TimeField,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {},
} satisfies Meta<typeof TimeField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<TimeField {...props}>
				<Label>{"Meeting time"}</Label>
				<DateInput />
			</TimeField>
		);
	},
};

export const WithSeconds: Story = {
	args: {},
	render(props) {
		return (
			<TimeField granularity="second" {...props}>
				<Label>{"Event time"}</Label>
				<DateInput />
			</TimeField>
		);
	},
};

export const Disabled: Story = {
	args: {},
	render(props) {
		return (
			<TimeField isDisabled={true} {...props}>
				<Label>{"Disabled time"}</Label>
				<DateInput />
			</TimeField>
		);
	},
};
