import { AcademicCapIcon, BookOpenIcon, UserIcon } from "@heroicons/react/20/solid";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { DropdownDescription, DropdownLabel } from "./dropdown";
import { Description, FieldError, Label } from "./field";
import { MultipleSelect, MultipleSelectContent, MultipleSelectItem } from "./multiple-select";

const meta = {
	title: "Components/MultipleSelect",
	component: MultipleSelect,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {},
} satisfies Meta<typeof MultipleSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

const frameworks = [
	{ id: "react", name: "React" },
	{ id: "vue", name: "Vue" },
	{ id: "angular", name: "Angular" },
	{ id: "svelte", name: "Svelte" },
	{ id: "solid", name: "Solid" },
	{ id: "qwik", name: "Qwik" },
	{ id: "ember", name: "Ember" },
];

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-80">
				<MultipleSelect {...props}>
					<Label>{"Frameworks"}</Label>
					<MultipleSelectContent items={frameworks}>
						{(item) => <MultipleSelectItem id={item.id}>{item.name}</MultipleSelectItem>}
					</MultipleSelectContent>
				</MultipleSelect>
			</div>
		);
	},
};

const roles = [
	{ id: "admin", name: "Admin" },
	{ id: "editor", name: "Editor" },
	{ id: "viewer", name: "Viewer" },
	{ id: "contributor", name: "Contributor" },
];

export const WithPlaceholder: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-80">
				<MultipleSelect
					aria-label={"Roles"}
					placeholder={"Select roles..."}
					searchPlaceholder={"Search roles..."}
					{...props}
				>
					<Label>{"Roles"}</Label>
					<MultipleSelectContent items={roles}>
						{(item) => <MultipleSelectItem id={item.id}>{item.name}</MultipleSelectItem>}
					</MultipleSelectContent>
				</MultipleSelect>
			</div>
		);
	},
};

export const WithDescription: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-80">
				<MultipleSelect aria-label={"Frameworks"} {...props}>
					<Label>{"Frameworks"}</Label>
					<Description>{"Choose all frameworks you have experience with."}</Description>
					<MultipleSelectContent items={frameworks}>
						{(item) => <MultipleSelectItem id={item.id}>{item.name}</MultipleSelectItem>}
					</MultipleSelectContent>
				</MultipleSelect>
			</div>
		);
	},
};

export const Controlled: Story = {
	args: {},
	render(props) {
		const ControlledExample = () => {
			const [value, setValue] = useState<Array<string | number>>(["react", "svelte"]);

			return (
				<div className="inline-80">
					<MultipleSelect
						aria-label={"Frameworks"}
						{...props}
						onChange={(next) => {
							setValue(next as Array<string | number>);
						}}
						value={value}
					>
						<Label>{"Frameworks"}</Label>
						<MultipleSelectContent items={frameworks}>
							{(item) => <MultipleSelectItem id={item.id}>{item.name}</MultipleSelectItem>}
						</MultipleSelectContent>
					</MultipleSelect>
					<p className="mbs-2 text-muted-fg text-sm">
						{"Selected: "}
						{value.join(", ") || "none"}
					</p>
				</div>
			);
		};

		return <ControlledExample />;
	},
};

const manyItems = Array.from({ length: 50 }, (_, i) => {
	return {
		id: `item-${i}`,
		name: `Item ${i + 1}`,
	};
});

export const WithManyOptions: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-80">
				<MultipleSelect aria-label={"Items"} searchPlaceholder={"Filter items..."} {...props}>
					<Label>{"Items"}</Label>
					<MultipleSelectContent items={manyItems}>
						{(item) => <MultipleSelectItem id={item.id}>{item.name}</MultipleSelectItem>}
					</MultipleSelectContent>
				</MultipleSelect>
			</div>
		);
	},
};

export const Invalid: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-80">
				<MultipleSelect aria-label={"Frameworks"} isInvalid={true} isRequired={true} {...props}>
					<Label>{"Frameworks"}</Label>
					<MultipleSelectContent items={frameworks}>
						{(item) => <MultipleSelectItem id={item.id}>{item.name}</MultipleSelectItem>}
					</MultipleSelectContent>
					<FieldError>{"Please select at least one framework."}</FieldError>
				</MultipleSelect>
			</div>
		);
	},
};

interface RichRole {
	id: string;
	name: string;
	description: string;
	icon: typeof UserIcon;
}

const richRoles: Array<RichRole> = [
	{
		id: "admin",
		name: "Admin",
		description: "Full access to all resources.",
		icon: UserIcon,
	},
	{
		id: "editor",
		name: "Editor",
		description: "Can create and edit content.",
		icon: BookOpenIcon,
	},
	{
		id: "viewer",
		name: "Viewer",
		description: "Read-only access.",
		icon: AcademicCapIcon,
	},
];

export const WithRichItems: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-96">
				<MultipleSelect aria-label={"Roles"} searchPlaceholder={"Search roles..."} {...props}>
					<Label>{"Roles"}</Label>
					<MultipleSelectContent items={richRoles}>
						{(item) => (
							<MultipleSelectItem id={item.id} textValue={item.name}>
								<item.icon data-slot="icon" />
								<DropdownLabel>{item.name}</DropdownLabel>
								<DropdownDescription>{item.description}</DropdownDescription>
							</MultipleSelectItem>
						)}
					</MultipleSelectContent>
				</MultipleSelect>
			</div>
		);
	},
};

export const Wide: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-xl">
				<MultipleSelect
					aria-label={"Frameworks"}
					searchPlaceholder={"Type to filter..."}
					{...props}
				>
					<Label>{"Frameworks (wide layout)"}</Label>
					<MultipleSelectContent items={frameworks}>
						{(item) => <MultipleSelectItem id={item.id}>{item.name}</MultipleSelectItem>}
					</MultipleSelectContent>
				</MultipleSelect>
			</div>
		);
	},
};
