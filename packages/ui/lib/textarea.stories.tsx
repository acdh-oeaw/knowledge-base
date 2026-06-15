import type { Meta, StoryObj } from "@storybook/react-vite";

import { Description, Label } from "./field";
import { TextField } from "./text-field";
import { TextArea } from "./textarea";

const meta = {
	title: "Components/TextArea",
	component: TextArea,
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof TextArea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { placeholder: "Enter your message..." },
	render(props) {
		return (
			<div className="inline-64">
				<TextField>
					<Label>{"Message"}</Label>
					<TextArea {...props} />
				</TextField>
			</div>
		);
	},
};

export const WithDescription: Story = {
	args: { placeholder: "Describe your issue..." },
	render(props) {
		return (
			<div className="inline-64">
				<TextField>
					<Label>{"Description"}</Label>
					<TextArea {...props} />
					<Description>{"Max 500 characters."}</Description>
				</TextField>
			</div>
		);
	},
};
