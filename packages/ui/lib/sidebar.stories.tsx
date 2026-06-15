import {
	ChartBarIcon,
	Cog6ToothIcon,
	FolderIcon,
	HomeIcon,
	UserGroupIcon,
} from "@heroicons/react/20/solid";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Avatar } from "./avatar";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarItem,
	SidebarLabel,
	SidebarNav,
	SidebarProvider,
	SidebarSection,
	SidebarSectionGroup,
	SidebarSeparator,
	SidebarTrigger,
} from "./sidebar";

const meta = {
	title: "Components/Sidebar",
	component: Sidebar,
	parameters: {
		layout: "fullscreen",
	},
	tags: ["autodocs"],
	argTypes: {
		collapsible: {
			control: "select",
			options: ["hidden", "dock", "none"],
		},
		intent: {
			control: "select",
			options: ["default", "float", "inset"],
		},
	},
	args: {},
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

const navItems = [
	{ id: "overview", label: "Overview", icon: HomeIcon, href: "#", isCurrent: true },
	{ id: "analytics", label: "Analytics", icon: ChartBarIcon, href: "#" },
	{ id: "resources", label: "Resources", icon: FolderIcon, href: "#" },
	{ id: "team", label: "Team", icon: UserGroupIcon, href: "#" },
];

const settingsItems = [{ id: "settings", label: "Settings", icon: Cog6ToothIcon, href: "#" }];

export const Default: Story = {
	args: { collapsible: "dock" },
	render(props) {
		return (
			<SidebarProvider className="block-svh">
				<Sidebar {...props}>
					<SidebarHeader>
						<SidebarItem href="#">
							<Avatar initials="D" size="sm" />
							<SidebarLabel>{"DARIAH-EU"}</SidebarLabel>
						</SidebarItem>
					</SidebarHeader>

					<SidebarContent>
						<SidebarSectionGroup>
							<SidebarSection label={"Navigation"}>
								{navItems.map((item) => (
									<SidebarItem
										key={item.id}
										href={item.href}
										isCurrent={item.isCurrent}
										tooltip={item.label}
									>
										<item.icon />
										<SidebarLabel>{item.label}</SidebarLabel>
									</SidebarItem>
								))}
							</SidebarSection>

							<SidebarSeparator />

							<SidebarSection label={"Account"}>
								{settingsItems.map((item) => (
									<SidebarItem key={item.id} href={item.href} tooltip={item.label}>
										<item.icon />
										<SidebarLabel>{item.label}</SidebarLabel>
									</SidebarItem>
								))}
							</SidebarSection>
						</SidebarSectionGroup>
					</SidebarContent>

					<SidebarFooter>
						<SidebarItem href="#">
							<Avatar alt="Jane Smith" initials="JS" size="sm" />
							<SidebarLabel>{"Jane Smith"}</SidebarLabel>
						</SidebarItem>
					</SidebarFooter>
				</Sidebar>

				<SidebarInset>
					<SidebarNav>
						<SidebarTrigger />
						<span className="font-medium text-sm/6 text-fg">{"Overview"}</span>
					</SidebarNav>
					<div className="p-6">
						<p className="text-muted-fg text-sm/6">{"Main content area."}</p>
					</div>
				</SidebarInset>
			</SidebarProvider>
		);
	},
};
