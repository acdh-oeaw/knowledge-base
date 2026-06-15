import type { Meta, StoryObj } from "@storybook/react-vite";

import { Description, FieldError, Label } from "./field";
import { NumberField, NumberInput } from "./number-field";

const meta = {
	title: "Components/NumberField",
	component: NumberField,
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof NumberField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-64">
				<NumberField {...props}>
					<Label>{"Quantity"}</Label>
					<NumberInput />
				</NumberField>
			</div>
		);
	},
};

export const WithDescription: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-64">
				<NumberField {...props}>
					<Label>{"Price"}</Label>
					<NumberInput placeholder={"0.00"} />
					<Description>{"Enter the price in euros."}</Description>
				</NumberField>
			</div>
		);
	},
};

export const Required: Story = {
	args: { isRequired: true },
	render(props) {
		return (
			<div className="inline-64">
				<NumberField {...props}>
					<Label>{"Amount"}</Label>
					<NumberInput />
					<FieldError />
				</NumberField>
			</div>
		);
	},
};

export const Disabled: Story = {
	args: { isDisabled: true, defaultValue: 42 },
	render(props) {
		return (
			<div className="inline-64">
				<NumberField {...props}>
					<Label>{"Count"}</Label>
					<NumberInput />
				</NumberField>
			</div>
		);
	},
};

export const WithMinMax: Story = {
	args: { minValue: 0, maxValue: 100, defaultValue: 50 },
	render(props) {
		return (
			<div className="inline-64">
				<NumberField {...props}>
					<Label>{"Percentage"}</Label>
					<NumberInput />
					<Description>{"Enter a value between 0 and 100."}</Description>
				</NumberField>
			</div>
		);
	},
};
