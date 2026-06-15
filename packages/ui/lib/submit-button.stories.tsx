import type { Meta, StoryObj } from "@storybook/react-vite";

import { SubmitButton } from "./submit-button";

const meta = {
	title: "Components/SubmitButton",
	component: SubmitButton,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof SubmitButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { children: "Save changes" },
	render(props) {
		const { children, ...rest } = props;
		return (
			<form>
				<SubmitButton {...rest}>{children}</SubmitButton>
			</form>
		);
	},
};
