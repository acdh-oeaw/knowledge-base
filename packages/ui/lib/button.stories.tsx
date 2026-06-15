import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Button } from "./button";

const meta = {
	title: "Components/Button",
	component: Button,
	tags: ["autodocs"],
	argTypes: {},
	args: {
		// oxlint-disable-next-line typescript/strict-void-return
		onPress: fn(),
	},
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { children: "Update" },
	render(props) {
		const { children, ...rest } = props;
		return <Button {...rest}>{children}</Button>;
	},
};
