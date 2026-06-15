import type { Meta, StoryObj } from "@storybook/react-vite";

import { Heading } from "./heading";

const meta = {
	title: "Components/Heading",
	component: Heading,
	tags: ["autodocs"],
	argTypes: {
		level: {
			control: "select",
			options: [1, 2, 3, 4, 5, 6],
		},
	},
	args: {},
} satisfies Meta<typeof Heading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { children: "Page heading", level: 1 },
	render(props) {
		const { children, ...rest } = props;
		return <Heading {...rest}>{children}</Heading>;
	},
};

export const AllLevels: Story = {
	args: {},
	render() {
		return (
			<div className="flex flex-col gap-4">
				<Heading level={1}>{"Heading level 1"}</Heading>
				<Heading level={2}>{"Heading level 2"}</Heading>
				<Heading level={3}>{"Heading level 3"}</Heading>
				<Heading level={4}>{"Heading level 4"}</Heading>
			</div>
		);
	},
};
