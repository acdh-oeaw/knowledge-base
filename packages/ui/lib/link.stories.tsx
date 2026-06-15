import type { Meta, StoryObj } from "@storybook/react-vite";

import { Link } from "./link";

const meta = {
	title: "Components/Link",
	component: Link,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof Link>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { children: "View details", href: "#" },
	render(props) {
		const { children, ...rest } = props;
		return <Link {...rest}>{children}</Link>;
	},
};
