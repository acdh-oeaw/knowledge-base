import type { Meta, StoryObj } from "@storybook/react-vite";

import { LineChart } from "./line-chart";

const meta = {
	title: "Components/LineChart",
	component: LineChart,
	tags: ["autodocs"],
	args: {},
} satisfies Meta<typeof LineChart>;

export default meta;

type Story = StoryObj<typeof meta>;

const years = ["2021", "2022", "2023", "2024", "2025"];

const formatEuros = (value: number) =>
	new Intl.NumberFormat("en", {
		style: "currency",
		currency: "EUR",
		maximumFractionDigits: 0,
	}).format(value);

export const Default: Story = {
	args: {
		"aria-label": "Reported project contributions per campaign year",
		categories: years,
		formatValue: formatEuros,
		series: [
			{
				key: "contributions",
				label: "Project contributions",
				values: [420_000, 515_000, 480_000, 690_000, 745_000],
			},
		],
	},
	render(props) {
		return (
			<div className="inline-full max-inline-2xl">
				<LineChart {...props} />
			</div>
		);
	},
};

export const MultipleSeries: Story = {
	args: {
		"aria-label": "Contributors per campaign year",
		categories: years,
		formatValue: (value) => new Intl.NumberFormat("en").format(value),
		series: [
			{ key: "contributors", label: "Contributors", values: [120, 145, 160, 158, 190] },
			{ key: "events", label: "Events", values: [60, 72, 95, 88, 110] },
		],
	},
	render(props) {
		return (
			<div className="inline-full max-inline-2xl">
				<LineChart {...props} />
			</div>
		);
	},
};

/** A missing campaign is a gap in the line, never a drop to zero — zero would be a measurement. */
export const WithGaps: Story = {
	args: {
		"aria-label": "Contributors per campaign year",
		categories: years,
		formatValue: (value) => new Intl.NumberFormat("en").format(value),
		series: [{ key: "contributors", label: "Contributors", values: [120, 145, null, 158, 190] }],
	},
	render(props) {
		return (
			<div className="inline-full max-inline-2xl">
				<LineChart {...props} />
			</div>
		);
	},
};
