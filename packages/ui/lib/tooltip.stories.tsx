import type { Meta, StoryObj } from "@storybook/react-vite";
import { PencilIcon } from "lucide-react";

import { Button } from "@/lib/button";
import { Tooltip, TooltipContent } from "@/lib/tooltip";

const meta = {
	title: "Components/Tooltip",
	component: Tooltip,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		children: "Tooltip",
		delay: 0,
	},
	render(props) {
		const { children, ...rest } = props;

		return (
			<Tooltip {...rest}>
				<Button aria-label={"Edit"} intent="plain" size="sq-sm">
					<PencilIcon aria-hidden={true} data-slot="icon" />
				</Button>
				<TooltipContent arrow={false} inverse={true} placement="top">
					{children}
				</TooltipContent>
			</Tooltip>
		);
	},
};
