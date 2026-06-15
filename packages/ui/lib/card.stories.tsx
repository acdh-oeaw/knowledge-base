import type { Meta, StoryObj } from "@storybook/react-vite";

import { Card, CardHeader } from "./card";

const meta = {
	title: "Components/Card",
	component: Card,
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { title: "Project" },
	render(props) {
		const { title, ...rest } = props;
		return (
			<Card {...rest}>
				<CardHeader description={"Lorem cardsum"} title={title} />
			</Card>
		);
	},
};
