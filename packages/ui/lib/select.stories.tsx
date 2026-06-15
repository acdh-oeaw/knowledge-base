import { AcademicCapIcon, BookOpenIcon, UserIcon } from "@heroicons/react/20/solid";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Description, FieldError, Label } from "./field";
import {
	Select,
	SelectContent,
	SelectDescription,
	SelectItem,
	SelectLabel,
	SelectSection,
	SelectSeparator,
	SelectTrigger,
} from "./select";

const meta = {
	title: "Components/Select",
	component: Select,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	argTypes: {},
	args: {},
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

const countries = [
	{ id: "at", name: "Austria" },
	{ id: "de", name: "Germany" },
	{ id: "fr", name: "France" },
	{ id: "es", name: "Spain" },
	{ id: "it", name: "Italy" },
	{ id: "pt", name: "Portugal" },
];

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-72">
				<Select {...props}>
					<Label>{"Country"}</Label>
					<SelectTrigger />
					<SelectContent>
						{countries.map((c) => (
							<SelectItem key={c.id} id={c.id}>
								{c.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		);
	},
};

export const WithPlaceholder: Story = {
	args: { placeholder: "Select a role..." },
	render(props) {
		return (
			<div className="inline-72">
				<Select {...props}>
					<Label>{"Role"}</Label>
					<SelectTrigger />
					<SelectContent>
						<SelectItem id="admin">{"Admin"}</SelectItem>
						<SelectItem id="editor">{"Editor"}</SelectItem>
						<SelectItem id="viewer">{"Viewer"}</SelectItem>
					</SelectContent>
				</Select>
			</div>
		);
	},
};

export const WithDescription: Story = {
	args: { placeholder: "Pick a plan" },
	render(props) {
		return (
			<div className="inline-72">
				<Select {...props}>
					<Label>{"Plan"}</Label>
					<Description>{"Choose a subscription plan that fits your needs."}</Description>
					<SelectTrigger />
					<SelectContent>
						<SelectItem id="free">{"Free"}</SelectItem>
						<SelectItem id="pro">{"Pro"}</SelectItem>
						<SelectItem id="team">{"Team"}</SelectItem>
					</SelectContent>
				</Select>
			</div>
		);
	},
};

export const WithRichItems: Story = {
	args: { placeholder: "Choose a role" },
	render(props) {
		return (
			<div className="inline-80">
				<Select {...props}>
					<Label>{"Role"}</Label>
					<SelectTrigger />
					<SelectContent>
						<SelectItem id="admin">
							<UserIcon data-slot="icon" />
							<SelectLabel>{"Admin"}</SelectLabel>
							<SelectDescription>{"Full access to all resources."}</SelectDescription>
						</SelectItem>
						<SelectItem id="editor">
							<BookOpenIcon data-slot="icon" />
							<SelectLabel>{"Editor"}</SelectLabel>
							<SelectDescription>{"Can create and edit content."}</SelectDescription>
						</SelectItem>
						<SelectItem id="viewer">
							<AcademicCapIcon data-slot="icon" />
							<SelectLabel>{"Viewer"}</SelectLabel>
							<SelectDescription>{"Read-only access."}</SelectDescription>
						</SelectItem>
					</SelectContent>
				</Select>
			</div>
		);
	},
};

export const WithSections: Story = {
	args: { placeholder: "Pick a location" },
	render(props) {
		return (
			<div className="inline-72">
				<Select {...props}>
					<Label>{"Location"}</Label>
					<SelectTrigger />
					<SelectContent>
						<SelectSection title="Europe">
							<SelectItem id="at">{"Austria"}</SelectItem>
							<SelectItem id="de">{"Germany"}</SelectItem>
							<SelectItem id="fr">{"France"}</SelectItem>
						</SelectSection>
						<SelectSeparator />
						<SelectSection title="Americas">
							<SelectItem id="us">{"United States"}</SelectItem>
							<SelectItem id="ca">{"Canada"}</SelectItem>
							<SelectItem id="br">{"Brazil"}</SelectItem>
						</SelectSection>
					</SelectContent>
				</Select>
			</div>
		);
	},
};

export const Controlled: Story = {
	args: {},
	render(props) {
		const ControlledExample = () => {
			const [value, setValue] = useState<string | number | null>("de");

			return (
				<div className="inline-72">
					<Select
						{...props}
						onChange={(key) => {
							setValue(key as string | number | null);
						}}
						value={value}
					>
						<Label>{"Country"}</Label>
						<SelectTrigger />
						<SelectContent>
							{countries.map((c) => (
								<SelectItem key={c.id} id={c.id}>
									{c.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="mbs-2 text-muted-fg text-sm">
						{"Selected: "}
						{value ?? "none"}
					</p>
				</div>
			);
		};

		return <ControlledExample />;
	},
};

export const Disabled: Story = {
	args: { isDisabled: true, value: "de" },
	render(props) {
		return (
			<div className="inline-72">
				<Select {...props}>
					<Label>{"Country"}</Label>
					<SelectTrigger />
					<SelectContent>
						{countries.map((c) => (
							<SelectItem key={c.id} id={c.id}>
								{c.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		);
	},
};

export const Invalid: Story = {
	args: { isInvalid: true, isRequired: true, placeholder: "Select a country..." },
	render(props) {
		return (
			<div className="inline-72">
				<Select {...props}>
					<Label>{"Country"}</Label>
					<SelectTrigger />
					<FieldError>{"Please select a country."}</FieldError>
					<SelectContent>
						{countries.map((c) => (
							<SelectItem key={c.id} id={c.id}>
								{c.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		);
	},
};

const manyOptions = Array.from({ length: 50 }, (_, i) => {
	return {
		id: `n-${i}`,
		name: `Option ${i + 1}`,
	};
});

export const WithManyOptions: Story = {
	args: { placeholder: "Pick a number" },
	render(props) {
		return (
			<div className="inline-72">
				<Select {...props}>
					<Label>{"Number"}</Label>
					<SelectTrigger />
					<SelectContent>
						{manyOptions.map((item) => (
							<SelectItem key={item.id} id={item.id}>
								{item.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		);
	},
};
