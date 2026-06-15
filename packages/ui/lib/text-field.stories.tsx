import type { Meta, StoryObj } from "@storybook/react-vite";

import { Description, FieldError, Label } from "./field";
import { Input } from "./input";
import { TextField } from "./text-field";

const meta = {
	title: "Components/TextField",
	component: TextField,
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof TextField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-64">
				<TextField {...props}>
					<Label>{"Email"}</Label>
					<Input placeholder={"you@example.com"} type="email" />
				</TextField>
			</div>
		);
	},
};

export const WithDescription: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-64">
				<TextField {...props}>
					<Label>{"Email"}</Label>
					<Input placeholder={"you@example.com"} type="email" />
					<Description>{"We'll never share your email."}</Description>
				</TextField>
			</div>
		);
	},
};

export const Required: Story = {
	args: { isRequired: true },
	render(props) {
		return (
			<div className="inline-64">
				<TextField {...props}>
					<Label>{"Username"}</Label>
					<Input placeholder={"Enter username"} />
					<FieldError />
				</TextField>
			</div>
		);
	},
};

export const Disabled: Story = {
	args: { isDisabled: true, defaultValue: "john.doe" },
	render(props) {
		return (
			<div className="inline-64">
				<TextField {...props}>
					<Label>{"Username"}</Label>
					<Input />
				</TextField>
			</div>
		);
	},
};
