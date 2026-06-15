import type { Meta, StoryObj } from "@storybook/react-vite";

import { Code, Strong, Text, TextLink } from "./text";

const meta = {
	title: "Components/Text",
	component: Text,
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof Text>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { children: "The quick brown fox jumps over the lazy dog." },
	render(props) {
		const { children, ...rest } = props;
		return <Text {...rest}>{children}</Text>;
	},
};

export const WithInlineElements: Story = {
	args: {},
	render() {
		return (
			<Text>
				{"Run "}
				<Code>{"npm install"}</Code>
				{" to get started. See "}
				<Strong>{"Getting Started"}</Strong>
				{" for more info and "}
				<TextLink href="#">{"read the docs"}</TextLink>
				{"."}
			</Text>
		);
	},
};
