import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Label } from "./field";
import { Tag, TagGroup, TagList } from "./tag-group";

const meta = {
	title: "Components/TagGroup",
	component: TagGroup,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	argTypes: {},
	args: {
		// oxlint-disable-next-line typescript/strict-void-return
		onRemove: fn(),
	},
} satisfies Meta<typeof TagGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<TagGroup {...props}>
				<Label>{"Categories"}</Label>
				<TagList>
					<Tag id="research">{"Research"}</Tag>
					<Tag id="education">{"Education"}</Tag>
					<Tag id="culture">{"Culture"}</Tag>
					<Tag id="history">{"History"}</Tag>
				</TagList>
			</TagGroup>
		);
	},
};

export const Removable: Story = {
	args: {},
	render(props) {
		return (
			<TagGroup {...props}>
				<Label>{"Selected filters"}</Label>
				<TagList>
					<Tag id="2020">{"2020"}</Tag>
					<Tag id="2021">{"2021"}</Tag>
					<Tag id="2022">{"2022"}</Tag>
				</TagList>
			</TagGroup>
		);
	},
};
