import { UserCircleIcon } from "@heroicons/react/20/solid";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
	GridList,
	GridListDescription,
	GridListHeader,
	GridListItem,
	GridListLabel,
	GridListSection,
	GridListStart,
} from "./grid-list";

const meta = {
	title: "Components/GridList",
	component: GridList,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {},
} satisfies Meta<typeof GridList>;

export default meta;

type Story = StoryObj<typeof meta>;

const members = [
	{ id: "1", name: "Jane Smith", role: "Admin" },
	{ id: "2", name: "John Doe", role: "Editor" },
	{ id: "3", name: "Alice Johnson", role: "Viewer" },
];

export const Default: Story = {
	args: {},
	render() {
		return (
			<div className="inline-72">
				<GridList aria-label={"Team members"}>
					{members.map((member) => (
						<GridListItem key={member.id} id={member.id} textValue={member.name}>
							<GridListStart>
								<UserCircleIcon className="block-8 inline-8 text-muted-fg" />
								<div>
									<GridListLabel>{member.name}</GridListLabel>
									<GridListDescription>{member.role}</GridListDescription>
								</div>
							</GridListStart>
						</GridListItem>
					))}
				</GridList>
			</div>
		);
	},
};

export const Selectable: Story = {
	args: {},
	render() {
		return (
			<div className="inline-72">
				<GridList aria-label={"Team members"} selectionMode="multiple">
					{members.map((member) => (
						<GridListItem key={member.id} id={member.id} textValue={member.name}>
							<GridListStart>
								<div>
									<GridListLabel>{member.name}</GridListLabel>
									<GridListDescription>{member.role}</GridListDescription>
								</div>
							</GridListStart>
						</GridListItem>
					))}
				</GridList>
			</div>
		);
	},
};

export const WithSections: Story = {
	args: {},
	render() {
		return (
			<div className="inline-72">
				<GridList aria-label={"Team"}>
					<GridListSection>
						<GridListHeader>{"Administrators"}</GridListHeader>
						<GridListItem id="1" textValue="Jane Smith">
							<GridListLabel>{"Jane Smith"}</GridListLabel>
						</GridListItem>
						<GridListItem id="2" textValue="Bob Williams">
							<GridListLabel>{"Bob Williams"}</GridListLabel>
						</GridListItem>
					</GridListSection>
					<GridListSection>
						<GridListHeader>{"Editors"}</GridListHeader>
						<GridListItem id="3" textValue="John Doe">
							<GridListLabel>{"John Doe"}</GridListLabel>
						</GridListItem>
						<GridListItem id="4" textValue="Alice Johnson">
							<GridListLabel>{"Alice Johnson"}</GridListLabel>
						</GridListItem>
					</GridListSection>
				</GridList>
			</div>
		);
	},
};
