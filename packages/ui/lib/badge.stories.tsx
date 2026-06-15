import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "./badge";

const meta = {
	title: "Components/Badge",
	component: Badge,
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { children: "success" },
	render(props) {
		const { children, ...rest } = props;
		return <Badge {...rest}>{children}</Badge>;
	},
};

export const Intents: Story = {
	args: { children: null },
	render() {
		const intents = [
			"primary",
			"secondary",
			"success",
			"info",
			"emerald",
			"amber",
			"rose",
			"slate",
			"violet",
			"pink",
			"warning",
			"danger",
			"outline",
		] as const;

		return (
			<div className="flex flex-wrap gap-3">
				{intents.map((intent) => (
					<Badge key={intent} intent={intent}>
						{intent}
					</Badge>
				))}
			</div>
		);
	},
};
