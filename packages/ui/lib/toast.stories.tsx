import type { Meta, StoryObj } from "@storybook/react-vite";
import { Fragment } from "react";

import { Button } from "./button";
import { ToastRegion, queue } from "./toast";

const meta = {
	title: "Components/Toast",
	component: ToastRegion,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {},
} satisfies Meta<typeof ToastRegion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {},
	render() {
		return (
			<Fragment>
				<Button
					intent="outline"
					onPress={() => {
						queue.add({ title: "Changes saved", description: "Your changes have been saved." });
					}}
				>
					{"Show toast"}
				</Button>
				<ToastRegion />
			</Fragment>
		);
	},
};

export const TitleOnly: Story = {
	args: {},
	render() {
		return (
			<Fragment>
				<Button
					intent="outline"
					onPress={() => {
						queue.add({ title: "Profile updated" });
					}}
				>
					{"Show toast"}
				</Button>
				<ToastRegion />
			</Fragment>
		);
	},
};

export const Multiple: Story = {
	args: {},
	render() {
		return (
			<div className="flex gap-2">
				<Button
					intent="outline"
					onPress={() => {
						queue.add({ title: "File uploaded", description: "document.pdf has been uploaded." });
					}}
				>
					{"Upload"}
				</Button>
				<Button
					intent="outline"
					onPress={() => {
						queue.add({ title: "File deleted", description: "photo.jpg has been removed." });
					}}
				>
					{"Delete"}
				</Button>
				<Button
					intent="outline"
					onPress={() => {
						queue.add({ title: "Invitation sent", description: "An email was sent to the team." });
					}}
				>
					{"Invite"}
				</Button>
				<ToastRegion />
			</div>
		);
	},
};
