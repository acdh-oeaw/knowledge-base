import type { Meta, StoryObj } from "@storybook/react-vite";

import { Label } from "./field";
import { SearchField, SearchInput } from "./search-field";

const meta = {
	title: "Components/SearchField",
	component: SearchField,
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof SearchField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-64">
				<SearchField {...props}>
					<Label>{"Search"}</Label>
					<SearchInput placeholder={"Search..."} />
				</SearchField>
			</div>
		);
	},
};
