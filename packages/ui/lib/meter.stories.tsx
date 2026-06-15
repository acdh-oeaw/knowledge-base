import type { Meta, StoryObj } from "@storybook/react-vite";

import { Meter, MeterHeader, MeterTrack, MeterValue } from "./meter";

const meta = {
	title: "Components/Meter",
	component: Meter,
	tags: ["autodocs"],
	argTypes: {
		value: { control: { type: "range", min: 0, max: 100 } },
	},
	args: {},
} satisfies Meta<typeof Meter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { value: 40, "aria-label": "Storage used" },
	render(props) {
		return (
			<div className="inline-64">
				<Meter {...props}>
					<MeterHeader>
						<span>{"Storage used"}</span>
						<MeterValue />
					</MeterHeader>
					<MeterTrack />
				</Meter>
			</div>
		);
	},
};

export const Warning: Story = {
	args: { value: 70, "aria-label": "Storage used" },
	render(props) {
		return (
			<div className="inline-64">
				<Meter {...props}>
					<MeterHeader>
						<span>{"Storage used"}</span>
						<MeterValue />
					</MeterHeader>
					<MeterTrack />
				</Meter>
			</div>
		);
	},
};

export const Critical: Story = {
	args: { value: 90, "aria-label": "Storage used" },
	render(props) {
		return (
			<div className="inline-64">
				<Meter {...props}>
					<MeterHeader>
						<span>{"Storage used"}</span>
						<MeterValue />
					</MeterHeader>
					<MeterTrack />
				</Meter>
			</div>
		);
	},
};
