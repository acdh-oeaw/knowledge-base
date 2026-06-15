import type { Meta, StoryObj } from "@storybook/react-vite";

import { DateField, DateInput } from "./date-field";
import { FieldError, Label } from "./field";

const meta = {
	title: "Components/DateField",
	component: DateField,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {},
} satisfies Meta<typeof DateField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<DateField {...props}>
				<Label>{"Birth date"}</Label>
				<DateInput />
			</DateField>
		);
	},
};

export const WithValidation: Story = {
	args: {},
	render(props) {
		return (
			<DateField isRequired={true} {...props}>
				<Label>{"Appointment date"}</Label>
				<DateInput />
				<FieldError />
			</DateField>
		);
	},
};

export const Disabled: Story = {
	args: {},
	render(props) {
		return (
			<DateField isDisabled={true} {...props}>
				<Label>{"Disabled date"}</Label>
				<DateInput />
			</DateField>
		);
	},
};
