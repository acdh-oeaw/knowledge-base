import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tab, TabList, TabPanel, Tabs } from "./tabs";

const meta = {
	title: "Components/Tabs",
	component: Tabs,
	tags: ["autodocs"],
	argTypes: {
		orientation: {
			control: "select",
			options: ["horizontal", "vertical"],
		},
	},
	args: {},
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<Tabs {...props}>
				<TabList aria-label={"History"}>
					<Tab id="overview">{"Overview"}</Tab>
					<Tab id="activity">{"Activity"}</Tab>
					<Tab id="settings">{"Settings"}</Tab>
				</TabList>
				<TabPanel id="overview">{"Overview content"}</TabPanel>
				<TabPanel id="activity">{"Activity content"}</TabPanel>
				<TabPanel id="settings">{"Settings content"}</TabPanel>
			</Tabs>
		);
	},
};

export const Vertical: Story = {
	args: { orientation: "vertical" },
	render(props) {
		return (
			<Tabs {...props}>
				<TabList aria-label={"Settings"}>
					<Tab id="profile">{"Profile"}</Tab>
					<Tab id="account">{"Account"}</Tab>
					<Tab id="security">{"Security"}</Tab>
				</TabList>
				<TabPanel id="profile">{"Profile settings"}</TabPanel>
				<TabPanel id="account">{"Account settings"}</TabPanel>
				<TabPanel id="security">{"Security settings"}</TabPanel>
			</Tabs>
		);
	},
};
