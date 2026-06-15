import type { Meta, StoryObj } from "@storybook/react-vite";

import { Note } from "./note";

const meta = {
	title: "Components/Note",
	component: Note,
	tags: ["autodocs"],
	argTypes: {
		intent: {
			control: "select",
			options: ["default", "info", "warning", "danger", "success"],
		},
		indicator: {
			control: "boolean",
		},
	},
	args: {},
} satisfies Meta<typeof Note>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { children: "This is a default note.", intent: "default" },
	render(props) {
		const { children, ...rest } = props;
		return <Note {...rest}>{children}</Note>;
	},
};

export const Info: Story = {
	args: { children: "Your session will expire in 5 minutes.", intent: "info" },
	render(props) {
		const { children, ...rest } = props;
		return <Note {...rest}>{children}</Note>;
	},
};

export const Warning: Story = {
	args: { children: "This action cannot be undone.", intent: "warning" },
	render(props) {
		const { children, ...rest } = props;
		return <Note {...rest}>{children}</Note>;
	},
};

export const Danger: Story = {
	args: { children: "Your account will be permanently deleted.", intent: "danger" },
	render(props) {
		const { children, ...rest } = props;
		return <Note {...rest}>{children}</Note>;
	},
};

export const Success: Story = {
	args: { children: "Your changes have been saved successfully.", intent: "success" },
	render(props) {
		const { children, ...rest } = props;
		return <Note {...rest}>{children}</Note>;
	},
};
