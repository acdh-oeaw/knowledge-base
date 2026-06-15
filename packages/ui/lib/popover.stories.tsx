import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { Popover, PopoverBody, PopoverContent, PopoverHeader, PopoverTitle } from "./popover";

const meta = {
	title: "Components/Popover",
	component: Popover,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {},
} satisfies Meta<typeof Popover>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		children: null,
	},
	render() {
		return (
			<Popover>
				<Button intent="outline">{"Open Popover"}</Button>
				<PopoverContent>
					<PopoverHeader>
						<PopoverTitle>{"About this feature"}</PopoverTitle>
					</PopoverHeader>
					<PopoverBody>
						<p className="text-sm/6 text-muted-fg">
							{
								"This popover provides additional context or actions related to the trigger element."
							}
						</p>
					</PopoverBody>
				</PopoverContent>
			</Popover>
		);
	},
};

export const WithArrow: Story = {
	args: {
		children: null,
	},
	render() {
		return (
			<Popover>
				<Button intent="outline">{"Open Popover with Arrow"}</Button>
				<PopoverContent arrow={true}>
					<PopoverHeader>
						<PopoverTitle>{"Tip"}</PopoverTitle>
					</PopoverHeader>
					<PopoverBody>
						<p className="text-sm/6 text-muted-fg">
							{"This popover has an arrow pointing to its trigger."}
						</p>
					</PopoverBody>
				</PopoverContent>
			</Popover>
		);
	},
};

export const PlacementTop: Story = {
	args: {
		children: null,
	},
	render() {
		return (
			<Popover>
				<Button intent="outline">{"Open Above"}</Button>
				<PopoverContent placement="top">
					<PopoverBody>
						<p className="text-sm/6 text-muted-fg">{"This popover appears above the trigger."}</p>
					</PopoverBody>
				</PopoverContent>
			</Popover>
		);
	},
};
