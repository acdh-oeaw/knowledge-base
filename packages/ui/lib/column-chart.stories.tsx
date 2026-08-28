import type { Meta, StoryObj } from "@storybook/react-vite";

import { ColumnChart } from "./column-chart";

const meta = {
	title: "Components/ColumnChart",
	component: ColumnChart,
	tags: ["autodocs"],
	args: {},
} satisfies Meta<typeof ColumnChart>;

export default meta;

type Story = StoryObj<typeof meta>;

const years = ["2021", "2022", "2023", "2024", "2025"];

const formatCount = (value: number) => new Intl.NumberFormat("en").format(value);

/**
 * One series, so no legend — the heading above the chart already says what is plotted, and a
 * one-swatch box would only restate it.
 */
export const Default: Story = {
	args: {
		"aria-label": "Country reports per campaign year",
		categories: years,
		formatValue: formatCount,
		series: [{ key: "reports", label: "Country reports", values: [14, 16, 18, 19, 21] }],
	},
	render(props) {
		return (
			<div className="inline-full max-inline-2xl">
				<ColumnChart {...props} />
			</div>
		);
	},
};

/**
 * Workflow status is _ordinal_, not nominal — draft precedes submitted precedes accepted — so it
 * takes the one-hue ordinal ramp and the reader sees the progression in the colour itself.
 */
export const StackedOrdinal: Story = {
	args: {
		"aria-label": "Country reports by workflow status",
		categories: years,
		formatValue: formatCount,
		palette: "ordinal",
		series: [
			{ key: "draft", label: "Draft", values: [6, 4, 3, 3, 8] },
			{ key: "submitted", label: "Submitted", values: [5, 6, 5, 4, 7] },
			{ key: "accepted", label: "Accepted", values: [3, 6, 10, 12, 6] },
		],
		stacked: true,
	},
	render(props) {
		return (
			<div className="inline-full max-inline-2xl">
				<ColumnChart {...props} />
			</div>
		);
	},
};

/** Separate entities are _identity_, so they take the categorical palette in slot order. */
export const Grouped: Story = {
	args: {
		"aria-label": "Reports by kind",
		categories: years,
		formatValue: formatCount,
		series: [
			{ key: "country", label: "Country reports", values: [14, 16, 18, 19, 21] },
			{ key: "working-group", label: "Working group reports", values: [8, 9, 11, 10, 12] },
		],
	},
	render(props) {
		return (
			<div className="inline-full max-inline-2xl">
				<ColumnChart {...props} />
			</div>
		);
	},
};
