import type { Meta, StoryObj } from "@storybook/react-vite";

import { RangeCalendar } from "./range-calendar";

const meta = {
	title: "Components/RangeCalendar",
	component: RangeCalendar,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {},
} satisfies Meta<typeof RangeCalendar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {},
	render(props) {
		return <RangeCalendar aria-label={"Select date range"} {...props} />;
	},
};

export const TwoMonths: Story = {
	args: {},
	render(props) {
		return (
			<RangeCalendar aria-label={"Select date range"} visibleDuration={{ months: 2 }} {...props} />
		);
	},
};
