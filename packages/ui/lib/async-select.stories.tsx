import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { AsyncSelect } from "./async-select";
import type { AsyncOption, AsyncOptionsFetchPage } from "./use-async-options";

interface Person extends AsyncOption {
	id: string;
	name: string;
	description?: string;
}

const allPeople: Array<Person> = Array.from({ length: 87 }, (_, i) => {
	return {
		id: `p-${i + 1}`,
		name: `Person ${i + 1}`,
		description: i % 3 === 0 ? `Description for person ${i + 1}` : undefined,
	};
});

const fetchPeople: AsyncOptionsFetchPage<Person> = async ({ limit, offset, q, signal }) => {
	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(resolve, 400);
		signal.addEventListener("abort", () => {
			clearTimeout(timer);
			reject(new DOMException("aborted", "AbortError"));
		});
	});

	const filtered =
		q === "" ? allPeople : allPeople.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

	return {
		items: filtered.slice(offset, offset + limit),
		total: filtered.length,
	};
};

const initialPage = allPeople.slice(0, 20);

const meta = {
	title: "Components/AsyncSelect",
	component: AsyncSelect<Person>,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {
		"aria-label": "Person",
		fetchPage: fetchPeople,
		initialItems: initialPage,
		initialTotal: allPeople.length,
		label: "Person",
		placeholder: "Select a person...",
		selectedItem: null,
		onSelect() {
			/* overridden by stories */
		},
	},
} satisfies Meta<typeof AsyncSelect<Person>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render() {
		const Example = () => {
			const [selected, setSelected] = useState<Person | null>(null);

			return (
				<div className="inline-80">
					<AsyncSelect<Person>
						aria-label="Person"
						fetchPage={fetchPeople}
						initialItems={initialPage}
						initialTotal={allPeople.length}
						label="Person"
						onSelect={setSelected}
						placeholder="Select a person..."
						selectedItem={selected}
					/>
					<p className="mbs-2 text-muted-fg text-sm">
						{"Selected: "}
						{selected?.name ?? "none"}
					</p>
				</div>
			);
		};

		return <Example />;
	},
};

export const WithDescriptions: Story = {
	render() {
		const Example = () => {
			const [selected, setSelected] = useState<Person | null>(null);

			return (
				<div className="inline-96">
					<AsyncSelect<Person>
						aria-label="Person"
						fetchPage={fetchPeople}
						initialItems={initialPage}
						initialTotal={allPeople.length}
						inputPlaceholder="Type to filter..."
						label="Person"
						onSelect={setSelected}
						placeholder="Select a person..."
						selectedItem={selected}
					/>
				</div>
			);
		};

		return <Example />;
	},
};

export const PreSelected: Story = {
	render() {
		const Example = () => {
			const [selected, setSelected] = useState<Person | null>(allPeople[5] ?? null);

			return (
				<div className="inline-80">
					<AsyncSelect<Person>
						aria-label="Person"
						fetchPage={fetchPeople}
						initialItems={initialPage}
						initialTotal={allPeople.length}
						label="Person"
						onSelect={setSelected}
						placeholder="Select a person..."
						selectedItem={selected}
					/>
				</div>
			);
		};

		return <Example />;
	},
};

export const Disabled: Story = {
	render() {
		return (
			<div className="inline-80">
				<AsyncSelect<Person>
					aria-label="Person"
					fetchPage={fetchPeople}
					initialItems={initialPage}
					initialTotal={allPeople.length}
					isDisabled={true}
					label="Person"
					onSelect={() => {
						/* no-op */
					}}
					placeholder="Select a person..."
					selectedItem={null}
				/>
			</div>
		);
	},
};

export const WithError: Story = {
	render() {
		return (
			<div className="inline-80">
				<AsyncSelect<Person>
					aria-label="Person"
					errorMessage="Please select a person."
					fetchPage={fetchPeople}
					initialItems={initialPage}
					initialTotal={allPeople.length}
					label="Person"
					onSelect={() => {
						/* no-op */
					}}
					placeholder="Select a person..."
					selectedItem={null}
				/>
			</div>
		);
	},
};

const fetchEmpty: AsyncOptionsFetchPage<Person> = async ({ signal }) => {
	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(resolve, 300);
		signal.addEventListener("abort", () => {
			clearTimeout(timer);
			reject(new DOMException("aborted", "AbortError"));
		});
	});

	return { items: [], total: 0 };
};

export const NoOptions: Story = {
	render() {
		return (
			<div className="inline-80">
				<AsyncSelect<Person>
					aria-label="Person"
					fetchPage={fetchEmpty}
					initialItems={[]}
					initialTotal={0}
					label="Person"
					loadOnMount={true}
					onSelect={() => {
						/* no-op */
					}}
					placeholder="Select a person..."
					selectedItem={null}
				/>
			</div>
		);
	},
};
