import type { Meta, StoryObj } from "@storybook/react-vite";

import {
	Carousel,
	CarouselButton,
	CarouselContent,
	CarouselHandler,
	CarouselItem,
} from "./carousel";

const meta = {
	title: "Components/Carousel",
	component: Carousel,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {},
} satisfies Meta<typeof Carousel>;

export default meta;

type Story = StoryObj<typeof meta>;

const slides = [
	{ id: 1, label: "Slide 1", bg: "bg-primary-subtle" },
	{ id: 2, label: "Slide 2", bg: "bg-success-subtle" },
	{ id: 3, label: "Slide 3", bg: "bg-warning-subtle" },
	{ id: 4, label: "Slide 4", bg: "bg-danger-subtle" },
];

export const Default: Story = {
	args: {},
	render() {
		return (
			<div className="inline-80">
				<Carousel>
					<CarouselContent>
						{slides.map((slide) => (
							<CarouselItem key={slide.id}>
								<div
									className={`flex block-40 items-center justify-center rounded-xl ${slide.bg} text-sm font-medium`}
								>
									{slide.label}
								</div>
							</CarouselItem>
						))}
					</CarouselContent>
					<CarouselHandler>
						<CarouselButton segment="previous" />
						<CarouselButton segment="next" />
					</CarouselHandler>
				</Carousel>
			</div>
		);
	},
};

export const MultipleVisible: Story = {
	args: {},
	render() {
		return (
			<div className="inline-96">
				<Carousel opts={{ align: "start" }}>
					<CarouselContent>
						{slides.map((slide) => (
							<CarouselItem key={slide.id} className="basis-1/2">
								<div
									className={`flex block-32 items-center justify-center rounded-xl ${slide.bg} text-sm font-medium`}
								>
									{slide.label}
								</div>
							</CarouselItem>
						))}
					</CarouselContent>
					<CarouselHandler>
						<CarouselButton segment="previous" />
						<CarouselButton segment="next" />
					</CarouselHandler>
				</Carousel>
			</div>
		);
	},
};
