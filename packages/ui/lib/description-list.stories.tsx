import type { Meta, StoryObj } from "@storybook/react-vite";

import { DescriptionDetails, DescriptionList, DescriptionTerm } from "./description-list";

const meta = {
	title: "Components/DescriptionList",
	component: DescriptionList,
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof DescriptionList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<DescriptionList {...props}>
				<DescriptionTerm>{"Full name"}</DescriptionTerm>
				<DescriptionDetails>{"Jane Smith"}</DescriptionDetails>
				<DescriptionTerm>{"Email"}</DescriptionTerm>
				<DescriptionDetails>{"jane.smith@example.com"}</DescriptionDetails>
				<DescriptionTerm>{"Role"}</DescriptionTerm>
				<DescriptionDetails>{"Editor"}</DescriptionDetails>
			</DescriptionList>
		);
	},
};
