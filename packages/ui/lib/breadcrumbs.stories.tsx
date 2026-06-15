import type { Meta, StoryObj } from "@storybook/react-vite";

import { Breadcrumbs, BreadcrumbsItem } from "./breadcrumbs";

const meta = {
	title: "Components/Breadcrumbs",
	component: Breadcrumbs,
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof Breadcrumbs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<Breadcrumbs {...props}>
				<BreadcrumbsItem>{"Overview"}</BreadcrumbsItem>
				<BreadcrumbsItem>{"Partners"}</BreadcrumbsItem>
			</Breadcrumbs>
		);
	},
};
