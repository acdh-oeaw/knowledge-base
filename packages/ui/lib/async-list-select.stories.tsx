import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { AsyncListSelect } from "./async-list-select";
import type { AsyncOption, AsyncOptionsFetchPage } from "./use-async-options";

interface Item extends AsyncOption {
	id: string;
	name: string;
	description?: string;
}

const allItems: Array<Item> = Array.from({ length: 64 }, (_, i) => {
	return {
		id: `i-${i + 1}`,
		name: `Item ${i + 1}`,
		description: i % 3 === 0 ? `Type ${(i % 5) + 1}` : undefined,
	};
});

const fetchItems: AsyncOptionsFetchPage<Item> = async ({ limit, offset, q, signal }) => {
	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(resolve, 300);
		signal.addEventListener("abort", () => {
			clearTimeout(timer);
			reject(new DOMException("aborted", "AbortError"));
		});
	});

	const filtered =
		q === "" ? allItems : allItems.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));

	return { items: filtered.slice(offset, offset + limit), total: filtered.length };
};

const initialPage = allItems.slice(0, 20);

const meta = {
	title: "Components/AsyncListSelect",
	component: AsyncListSelect<Item>,
	parameters: { layout: "centered" },
	decorators: [
		(Story) => (
			<div style={{ inlineSize: 360 }}>
				<Story />
			</div>
		),
	],
	tags: ["autodocs"],
	args: {
		"aria-label": "Items",
		fetchPage: fetchItems,
		initialItems: initialPage,
		initialTotal: allItems.length,
		label: "Items",
		value: [],
		onChange() {
			/* overridden by stories */
		},
	},
} satisfies Meta<typeof AsyncListSelect<Item>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const List: Story = {
	render: function Render(args) {
		const [value, setValue] = useState<Array<string>>(["i-1", "i-2"]);
		return <AsyncListSelect {...args} onChange={setValue} value={value} />;
	},
};

export const Orderable: Story = {
	render: function Render(args) {
		const [value, setValue] = useState<Array<string>>(["i-1", "i-2", "i-3"]);
		return <AsyncListSelect {...args} isOrderable={true} onChange={setValue} value={value} />;
	},
};
