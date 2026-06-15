import { ArchiveBoxIcon, PencilSquareIcon, TrashIcon, UserIcon } from "@heroicons/react/20/solid";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { Menu, MenuContent, MenuHeader, MenuItem, MenuSection, MenuSeparator } from "./menu";

const meta = {
	title: "Components/Menu",
	component: Menu,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {},
} satisfies Meta<typeof Menu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		children: null,
	},
	render() {
		return (
			<Menu>
				<Button intent="outline">{"Options"}</Button>
				<MenuContent>
					<MenuItem>{"View profile"}</MenuItem>
					<MenuItem>{"Edit settings"}</MenuItem>
					<MenuItem>{"Sign out"}</MenuItem>
				</MenuContent>
			</Menu>
		);
	},
};

export const WithIcons: Story = {
	args: {
		children: null,
	},
	render() {
		return (
			<Menu>
				<Button intent="outline">{"Actions"}</Button>
				<MenuContent>
					<MenuItem textValue="Profile">
						<UserIcon />
						{"Profile"}
					</MenuItem>
					<MenuItem textValue="Edit">
						<PencilSquareIcon />
						{"Edit"}
					</MenuItem>
					<MenuItem textValue="Archive">
						<ArchiveBoxIcon />
						{"Archive"}
					</MenuItem>
					<MenuSeparator />
					<MenuItem intent="danger" textValue="Delete">
						<TrashIcon />
						{"Delete"}
					</MenuItem>
				</MenuContent>
			</Menu>
		);
	},
};

export const WithSections: Story = {
	args: {
		children: null,
	},
	render() {
		return (
			<Menu>
				<Button intent="outline">{"Open Menu"}</Button>
				<MenuContent>
					<MenuHeader>{"My Account"}</MenuHeader>
					<MenuSection label={"Profile"}>
						<MenuItem>{"View profile"}</MenuItem>
						<MenuItem>{"Edit profile"}</MenuItem>
					</MenuSection>
					<MenuSeparator />
					<MenuSection label={"Settings"}>
						<MenuItem>{"Preferences"}</MenuItem>
						<MenuItem>{"Notifications"}</MenuItem>
					</MenuSection>
					<MenuSeparator />
					<MenuItem intent="danger">{"Sign out"}</MenuItem>
				</MenuContent>
			</Menu>
		);
	},
};
