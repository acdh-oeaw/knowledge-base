"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { useExtracted } from "next-intl";
import {
	type ComponentProps,
	type HTMLAttributes,
	type KeyboardEvent,
	type ReactNode,
	createContext,
	use,
	useCallback,
	useEffect,
	useState,
} from "react";
import { twMerge } from "tailwind-merge";

import { Button, type ButtonProps } from "@/lib/button";
import { cx } from "@/lib/primitive";

export type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

type CarouselContextProps = {
	carouselRef: ReturnType<typeof useEmblaCarousel>[0];
	api: ReturnType<typeof useEmblaCarousel>[1];
	scrollPrev: () => void;
	scrollNext: () => void;
	canScrollPrev: boolean;
	canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = createContext<CarouselContextProps | null>(null);

const useCarousel = () => {
	const context = use(CarouselContext);

	if (!context) {
		throw new Error("useCarousel must be used within a <Carousel />");
	}

	return context;
};

interface CarouselRootProps {
	CarouselContent?: typeof CarouselContent;
	CarouselHandler?: typeof CarouselHandler;
	CarouselItem?: typeof CarouselItem;
	CarouselButton?: typeof CarouselButton;
}

interface CarouselProps extends HTMLAttributes<HTMLDivElement>, CarouselRootProps {
	opts?: CarouselOptions;
	plugins?: CarouselPlugin;
	orientation?: "horizontal" | "vertical";
	setApi?: (api: CarouselApi) => void;
}

export function Carousel({
	orientation = "horizontal",
	opts,
	setApi,
	plugins,
	className,
	children,
	...props
}: Readonly<CarouselProps>): ReactNode {
	const [carouselRef, api] = useEmblaCarousel(
		{
			...opts,
			axis: orientation === "horizontal" ? "x" : "y",
		},
		plugins,
	);
	const [canScrollPrev, setCanScrollPrev] = useState(false);
	const [canScrollNext, setCanScrollNext] = useState(false);

	const onSelect = useCallback((api: CarouselApi) => {
		if (!api) {
			return;
		}

		setCanScrollPrev(api.canScrollPrev());
		setCanScrollNext(api.canScrollNext());
	}, []);

	const scrollPrev = useCallback(() => {
		api?.scrollPrev();
	}, [api]);

	const scrollNext = useCallback(() => {
		api?.scrollNext();
	}, [api]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (event.key === "ArrowLeft") {
				event.preventDefault();
				scrollPrev();
			} else if (event.key === "ArrowRight") {
				event.preventDefault();
				scrollNext();
			}
		},
		[scrollPrev, scrollNext],
	);

	useEffect(() => {
		if (!api || !setApi) {
			return;
		}

		setApi(api);
	}, [api, setApi]);

	useEffect(() => {
		if (!api) {
			return;
		}

		// eslint-disable-next-line react-hooks/set-state-in-effect
		onSelect(api);
		api.on("reInit", onSelect);
		api.on("select", onSelect);

		return () => {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			api?.off("select", onSelect);
		};
	}, [api, onSelect]);

	return (
		<CarouselContext
			value={{
				carouselRef,
				api,
				opts,
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				orientation: orientation ?? (opts?.axis === "y" ? "vertical" : "horizontal"),
				scrollPrev,
				scrollNext,
				canScrollPrev,
				canScrollNext,
			}}
		>
			<div
				aria-roledescription="carousel"
				className={twMerge("relative", className)}
				onKeyDownCapture={handleKeyDown}
				role="region"
				{...props}
			>
				{children}
			</div>
		</CarouselContext>
	);
}

export function CarouselContent({
	className,
	...props
}: Readonly<ComponentProps<"div">>): ReactNode {
	const { carouselRef, orientation } = useCarousel();

	return (
		<div ref={carouselRef} className="overflow-hidden">
			<div
				className={twMerge(
					"flex",
					orientation === "horizontal" ? "-ms-4" : "-mbs-4 flex-col",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

export function CarouselItem({ className, ...props }: Readonly<ComponentProps<"div">>): ReactNode {
	const { orientation } = useCarousel();

	return (
		<div
			className={twMerge(
				"group/carousel-item relative min-inline-0 shrink-0 grow-0 basis-full focus:outline-hidden focus-visible:outline-hidden",
				orientation === "horizontal" ? "ps-4" : "pbs-4",
				className,
			)}
			{...props}
		/>
	);
}

export function CarouselHandler({
	ref,
	className,
	...props
}: Readonly<ComponentProps<"div">>): ReactNode {
	const { orientation } = useCarousel();
	return (
		<div
			ref={ref}
			className={twMerge(
				"relative z-10 mbs-6 flex items-center gap-x-2",
				orientation === "horizontal" ? "justify-end" : "justify-center",
				className,
			)}
			data-slot="carousel-handler"
			{...props}
		/>
	);
}

export function CarouselButton({
	segment,
	className,
	intent = "outline",
	isCircle = true,
	size = "sq-sm",
	ref,
	...props
}: Readonly<ButtonProps & { segment: "previous" | "next" }>): ReactNode {
	const t = useExtracted("ui");

	const { orientation, scrollPrev, canScrollPrev, scrollNext, canScrollNext } = useCarousel();
	const isNext = segment === "next";
	const canScroll = isNext ? canScrollNext : canScrollPrev;
	const scroll = isNext ? scrollNext : scrollPrev;
	const Icon = isNext ? ChevronRightIcon : ChevronLeftIcon;

	return (
		<Button
			ref={ref}
			aria-label={isNext ? t("Next slide") : t("Previous slide")}
			className={cx([orientation === "vertical" ? "rotate-90" : "", "shrink-0"], className)}
			data-handler={segment}
			intent={intent}
			isCircle={isCircle}
			isDisabled={!canScroll}
			onPress={scroll}
			size={size}
			{...props}
		>
			<Icon className="block-4 inline-4" />
		</Button>
	);
}
