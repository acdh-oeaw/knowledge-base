import {
	ChartBarIcon,
	Cog6ToothIcon,
	DocumentIcon,
	HomeIcon,
	UserGroupIcon,
} from "@heroicons/react/20/solid";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Fragment, useState } from "react";

import { Button } from "./button";
import {
	CommandMenu,
	CommandMenuFooter,
	CommandMenuItem,
	CommandMenuList,
	CommandMenuSearch,
	CommandMenuSection,
	CommandMenuSeparator,
} from "./command-menu";

const meta = {
	title: "Components/CommandMenu",
	component: CommandMenu,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {},
} satisfies Meta<typeof CommandMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		children: null,
	},
	render() {
		// oxlint-disable-next-line react-hooks/rules-of-hooks
		const [isOpen, setIsOpen] = useState(false);

		return (
			<Fragment>
				<Button
					intent="outline"
					onPress={() => {
						setIsOpen(true);
					}}
				>
					{"Open Command Menu"}
				</Button>
				<CommandMenu isOpen={isOpen} onOpenChange={setIsOpen}>
					<CommandMenuSearch placeholder={"Search..."} />
					<CommandMenuList>
						<CommandMenuSection label={"Navigation"}>
							<CommandMenuItem textValue={"Home"}>
								<HomeIcon />
								{"Home"}
							</CommandMenuItem>
							<CommandMenuItem textValue={"Dashboard"}>
								<ChartBarIcon />
								{"Dashboard"}
							</CommandMenuItem>
							<CommandMenuItem textValue={"Team"}>
								<UserGroupIcon />
								{"Team"}
							</CommandMenuItem>
						</CommandMenuSection>
						<CommandMenuSeparator />
						<CommandMenuSection label={"Resources"}>
							<CommandMenuItem textValue={"Documents"}>
								<DocumentIcon />
								{"Documents"}
							</CommandMenuItem>
							<CommandMenuItem textValue={"Settings"}>
								<Cog6ToothIcon />
								{"Settings"}
							</CommandMenuItem>
						</CommandMenuSection>
					</CommandMenuList>
					<CommandMenuFooter>
						<span>
							{"Press "}
							<kbd>{"↑"}</kbd>
							<kbd>{"↓"}</kbd>
							{" to navigate, "}
							<kbd>{"↵"}</kbd>
							{" to select"}
						</span>
					</CommandMenuFooter>
				</CommandMenu>
			</Fragment>
		);
	},
};

export const WithShortcut: Story = {
	args: {
		children: null,
	},
	render() {
		// oxlint-disable-next-line react-hooks/rules-of-hooks
		const [isOpen, setIsOpen] = useState(false);

		return (
			<Fragment>
				<Button
					intent="outline"
					onPress={() => {
						setIsOpen(true);
					}}
				>
					{"Open (or press ⌘K)"}
				</Button>
				<CommandMenu isOpen={isOpen} onOpenChange={setIsOpen} shortcut="k">
					<CommandMenuSearch placeholder={"Type a command..."} />
					<CommandMenuList>
						<CommandMenuSection label={"Actions"}>
							<CommandMenuItem textValue={"New document"}>{"New document"}</CommandMenuItem>
							<CommandMenuItem textValue={"Open file"}>{"Open file"}</CommandMenuItem>
							<CommandMenuItem textValue={"Save"}>{"Save"}</CommandMenuItem>
						</CommandMenuSection>
					</CommandMenuList>
				</CommandMenu>
			</Fragment>
		);
	},
};
