import type { Meta, StoryObj } from "@storybook/react-vite";

import { DatePicker, DatePickerTrigger } from "./date-picker";

const meta = {
	title: "Components/DatePicker",
	component: DatePicker,
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof DatePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<DatePicker {...props}>
				<DatePickerTrigger />
			</DatePicker>
		);
	},
};
