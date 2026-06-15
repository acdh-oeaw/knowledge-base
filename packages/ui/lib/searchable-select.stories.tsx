import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Description, FieldError, Label } from "./field";
import {
	SearchableSelect,
	SearchableSelectContent,
	SearchableSelectDescription,
	SearchableSelectInput,
	SearchableSelectItem,
	SearchableSelectLabel,
} from "./searchable-select";

const meta = {
	title: "Components/SearchableSelect",
	component: SearchableSelect,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {},
} satisfies Meta<typeof SearchableSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

const countries = [
	{ id: "at", name: "Austria" },
	{ id: "de", name: "Germany" },
	{ id: "fr", name: "France" },
	{ id: "es", name: "Spain" },
	{ id: "it", name: "Italy" },
	{ id: "pt", name: "Portugal" },
	{ id: "nl", name: "Netherlands" },
	{ id: "be", name: "Belgium" },
	{ id: "ch", name: "Switzerland" },
	{ id: "se", name: "Sweden" },
	{ id: "no", name: "Norway" },
	{ id: "dk", name: "Denmark" },
	{ id: "fi", name: "Finland" },
];

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-72">
				<SearchableSelect {...props}>
					<Label>{"Country"}</Label>
					<SearchableSelectInput placeholder="Search countries..." />
					<SearchableSelectContent>
						{countries.map((c) => (
							<SearchableSelectItem key={c.id} id={c.id} textValue={c.name}>
								{c.name}
							</SearchableSelectItem>
						))}
					</SearchableSelectContent>
				</SearchableSelect>
			</div>
		);
	},
};

export const WithItemsProp: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-72">
				<SearchableSelect defaultItems={countries} {...props}>
					<Label>{"Country"}</Label>
					<SearchableSelectInput placeholder="Search..." />
					<SearchableSelectContent<(typeof countries)[number]>>
						{(item) => (
							<SearchableSelectItem id={item.id} textValue={item.name}>
								{item.name}
							</SearchableSelectItem>
						)}
					</SearchableSelectContent>
				</SearchableSelect>
			</div>
		);
	},
};

export const WithDescription: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-80">
				<SearchableSelect {...props}>
					<Label>{"Country"}</Label>
					<Description>{"Type to filter the list of countries."}</Description>
					<SearchableSelectInput placeholder="Search countries..." />
					<SearchableSelectContent>
						{countries.map((c) => (
							<SearchableSelectItem key={c.id} id={c.id} textValue={c.name}>
								{c.name}
							</SearchableSelectItem>
						))}
					</SearchableSelectContent>
				</SearchableSelect>
			</div>
		);
	},
};

export const WithRichItems: Story = {
	args: {},
	render(props) {
		const roles = [
			{ id: "admin", name: "Admin", description: "Full access to all resources." },
			{ id: "editor", name: "Editor", description: "Can create and edit content." },
			{ id: "viewer", name: "Viewer", description: "Read-only access." },
			{ id: "contributor", name: "Contributor", description: "Can submit content for review." },
		];

		return (
			<div className="inline-80">
				<SearchableSelect {...props}>
					<Label>{"Role"}</Label>
					<SearchableSelectInput placeholder="Search roles..." />
					<SearchableSelectContent>
						{roles.map((r) => (
							<SearchableSelectItem key={r.id} id={r.id} textValue={r.name}>
								<SearchableSelectLabel>{r.name}</SearchableSelectLabel>
								<SearchableSelectDescription>{r.description}</SearchableSelectDescription>
							</SearchableSelectItem>
						))}
					</SearchableSelectContent>
				</SearchableSelect>
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
					<SearchableSelect
						{...props}
						onChange={(key) => {
							setValue(key as string | number | null);
						}}
						value={value}
					>
						<Label>{"Country"}</Label>
						<SearchableSelectInput placeholder="Search..." />
						<SearchableSelectContent>
							{countries.map((c) => (
								<SearchableSelectItem key={c.id} id={c.id} textValue={c.name}>
									{c.name}
								</SearchableSelectItem>
							))}
						</SearchableSelectContent>
					</SearchableSelect>
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

export const Invalid: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-72">
				<SearchableSelect isInvalid={true} isRequired={true} {...props}>
					<Label>{"Country"}</Label>
					<SearchableSelectInput placeholder="Search..." />
					<FieldError>{"Please select a country."}</FieldError>
					<SearchableSelectContent>
						{countries.map((c) => (
							<SearchableSelectItem key={c.id} id={c.id} textValue={c.name}>
								{c.name}
							</SearchableSelectItem>
						))}
					</SearchableSelectContent>
				</SearchableSelect>
			</div>
		);
	},
};

export const Disabled: Story = {
	args: { isDisabled: true, value: "de" },
	render(props) {
		return (
			<div className="inline-72">
				<SearchableSelect {...props}>
					<Label>{"Country"}</Label>
					<SearchableSelectInput placeholder="Search..." />
					<SearchableSelectContent>
						{countries.map((c) => (
							<SearchableSelectItem key={c.id} id={c.id} textValue={c.name}>
								{c.name}
							</SearchableSelectItem>
						))}
					</SearchableSelectContent>
				</SearchableSelect>
			</div>
		);
	},
};
