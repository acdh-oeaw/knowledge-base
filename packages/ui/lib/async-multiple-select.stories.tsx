import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { AsyncMultipleSelect } from "./async-multiple-select";
import type { AsyncOption, AsyncOptionsFetchPage } from "./use-async-options";

interface Tag extends AsyncOption {
	id: string;
	name: string;
	description?: string;
}

const allTags: Array<Tag> = Array.from({ length: 64 }, (_, i) => {
	return {
		id: `t-${i + 1}`,
		name: `Tag ${i + 1}`,
		description: i % 4 === 0 ? `Notes about tag ${i + 1}` : undefined,
	};
});

const fetchTags: AsyncOptionsFetchPage<Tag> = async ({ limit, offset, q, signal }) => {
	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(resolve, 400);
		signal.addEventListener("abort", () => {
			clearTimeout(timer);
			reject(new DOMException("aborted", "AbortError"));
		});
	});

	const filtered =
		q === "" ? allTags : allTags.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));

	return {
		items: filtered.slice(offset, offset + limit),
		total: filtered.length,
	};
};

const initialPage = allTags.slice(0, 20);

const meta = {
	title: "Components/AsyncMultipleSelect",
	component: AsyncMultipleSelect<Tag>,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {
		"aria-label": "Tags",
		fetchPage: fetchTags,
		initialItems: initialPage,
		initialTotal: allTags.length,
		label: "Tags",
		placeholder: "Pick some tags...",
		value: [],
		onChange() {
			/* overridden by stories */
		},
	},
} satisfies Meta<typeof AsyncMultipleSelect<Tag>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render() {
		const Example = () => {
			const [value, setValue] = useState<Array<string>>([]);

			return (
				<div className="inline-96">
					<AsyncMultipleSelect<Tag>
						aria-label="Tags"
						fetchPage={fetchTags}
						initialItems={initialPage}
						initialTotal={allTags.length}
						label="Tags"
						onChange={setValue}
						placeholder="Pick some tags..."
						value={value}
					/>
					<p className="mbs-2 text-muted-fg text-sm">
						{"Selected: "}
						{value.join(", ") || "none"}
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
			const [value, setValue] = useState<Array<string>>([]);

			return (
				<div className="inline-160">
					<AsyncMultipleSelect<Tag>
						aria-label="Tags"
						fetchPage={fetchTags}
						initialItems={initialPage}
						initialTotal={allTags.length}
						inputPlaceholder="Type to filter..."
						label="Tags"
						onChange={setValue}
						placeholder="Pick some tags..."
						value={value}
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
			const [value, setValue] = useState<Array<string>>(["t-2", "t-5", "t-9"]);

			return (
				<div className="inline-96">
					<AsyncMultipleSelect<Tag>
						aria-label="Tags"
						fetchPage={fetchTags}
						initialItems={initialPage}
						initialTotal={allTags.length}
						label="Tags"
						onChange={setValue}
						placeholder="Pick some tags..."
						value={value}
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
			<div className="inline-96">
				<AsyncMultipleSelect<Tag>
					aria-label="Tags"
					fetchPage={fetchTags}
					initialItems={initialPage}
					initialTotal={allTags.length}
					isDisabled={true}
					label="Tags"
					onChange={() => {
						/* no-op */
					}}
					placeholder="Pick some tags..."
					value={["t-2"]}
				/>
			</div>
		);
	},
};

export const WithError: Story = {
	render() {
		return (
			<div className="inline-96">
				<AsyncMultipleSelect<Tag>
					aria-label="Tags"
					errorMessage="Please pick at least one tag."
					fetchPage={fetchTags}
					initialItems={initialPage}
					initialTotal={allTags.length}
					label="Tags"
					onChange={() => {
						/* no-op */
					}}
					placeholder="Pick some tags..."
					value={[]}
				/>
			</div>
		);
	},
};
