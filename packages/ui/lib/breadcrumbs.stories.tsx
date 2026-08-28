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

export const Truncated: Story = {
	args: {},
	render(props) {
		return (
			<div className="border border-dashed border-muted-fg p-2 inline-100">
				<Breadcrumbs {...props}>
					<BreadcrumbsItem href="#">{"Overview"}</BreadcrumbsItem>
					<BreadcrumbsItem href="#">{"Impact Case Studies"}</BreadcrumbsItem>
					<BreadcrumbsItem isTruncated={true}>
						{
							"A DARIAH impact case study: UDIGISH digital practices for the study of urban heritage is cooperating with artists and NGOs"
						}
					</BreadcrumbsItem>
					<BreadcrumbsItem>{"Details"}</BreadcrumbsItem>
				</Breadcrumbs>
			</div>
		);
	},
};
