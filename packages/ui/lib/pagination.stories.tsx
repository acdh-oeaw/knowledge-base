import type { Meta, StoryObj } from "@storybook/react-vite";

import {
	Pagination,
	PaginationGap,
	PaginationItem,
	PaginationList,
	PaginationNext,
	PaginationPrevious,
	PaginationSection,
} from "./pagination";

const meta = {
	title: "Components/Pagination",
	component: Pagination,
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof Pagination>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<Pagination {...props}>
				<PaginationSection>
					<PaginationPrevious href="#" />
				</PaginationSection>
				<PaginationList>
					<PaginationItem href="#" isCurrent={true}>
						{"1"}
					</PaginationItem>
					<PaginationItem href="#">{"2"}</PaginationItem>
					<PaginationItem href="#">{"3"}</PaginationItem>
					<PaginationGap />
					<PaginationItem href="#">{"8"}</PaginationItem>
					<PaginationItem href="#">{"9"}</PaginationItem>
				</PaginationList>
				<PaginationSection>
					<PaginationNext href="#" />
				</PaginationSection>
			</Pagination>
		);
	},
};
