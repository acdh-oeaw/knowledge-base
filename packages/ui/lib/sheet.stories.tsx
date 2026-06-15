import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "./sheet";

const meta = {
	title: "Components/Sheet",
	component: SheetContent,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	argTypes: {
		side: {
			control: "select",
			options: ["top", "bottom", "left", "right"],
		},
	},
	args: {},
} satisfies Meta<typeof SheetContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		children: null,
	},
	render(args) {
		return (
			<Sheet>
				<Button intent="outline">{"Open Sheet"}</Button>
				<SheetContent {...args}>
					<SheetHeader>
						<SheetTitle>{"Edit Profile"}</SheetTitle>
					</SheetHeader>
					<SheetBody>
						<p className="text-sm/6 text-muted-fg">
							{"Make changes to your profile here. Click save when you're done."}
						</p>
					</SheetBody>
					<SheetFooter>
						<Button intent="primary">{"Save changes"}</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		);
	},
};

export const Left: Story = {
	args: {
		children: null,
		side: "left",
	},
	render(args) {
		return (
			<Sheet>
				<Button intent="outline">{"Open Left Sheet"}</Button>
				<SheetContent {...args}>
					<SheetHeader>
						<SheetTitle>{"Navigation"}</SheetTitle>
					</SheetHeader>
					<SheetBody>
						<p className="text-sm/6 text-muted-fg">{"This sheet slides in from the left."}</p>
					</SheetBody>
				</SheetContent>
			</Sheet>
		);
	},
};

export const Bottom: Story = {
	args: {
		children: null,
		side: "bottom",
	},
	render(args) {
		return (
			<Sheet>
				<Button intent="outline">{"Open Bottom Sheet"}</Button>
				<SheetContent {...args}>
					<SheetHeader>
						<SheetTitle>{"More Options"}</SheetTitle>
					</SheetHeader>
					<SheetBody>
						<p className="text-sm/6 text-muted-fg">{"This sheet slides in from the bottom."}</p>
					</SheetBody>
				</SheetContent>
			</Sheet>
		);
	},
};
