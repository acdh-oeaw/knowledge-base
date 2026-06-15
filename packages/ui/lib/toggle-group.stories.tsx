import type { Meta, StoryObj } from "@storybook/react-vite";

import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

const meta = {
	title: "Components/ToggleGroup",
	component: ToggleGroup,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	argTypes: {
		size: {
			control: "select",
			options: ["xs", "sm", "md", "lg"],
		},
		selectionMode: {
			control: "select",
			options: ["single", "multiple"],
		},
	},
	args: {},
} satisfies Meta<typeof ToggleGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { defaultSelectedKeys: ["week"] },
	render(props) {
		return (
			<ToggleGroup {...props}>
				<ToggleGroupItem id="day">{"Day"}</ToggleGroupItem>
				<ToggleGroupItem id="week">{"Week"}</ToggleGroupItem>
				<ToggleGroupItem id="month">{"Month"}</ToggleGroupItem>
			</ToggleGroup>
		);
	},
};

export const Multiple: Story = {
	args: { selectionMode: "multiple", defaultSelectedKeys: ["bold", "italic"] },
	render(props) {
		return (
			<ToggleGroup {...props}>
				<ToggleGroupItem id="bold">{"Bold"}</ToggleGroupItem>
				<ToggleGroupItem id="italic">{"Italic"}</ToggleGroupItem>
				<ToggleGroupItem id="underline">{"Underline"}</ToggleGroupItem>
			</ToggleGroup>
		);
	},
};
