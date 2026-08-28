"use client";

import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { twMerge } from "tailwind-merge";

/**
 * A plotted series. `values` is positional — index `i` is the value at `categories[i]` — and `null`
 * means "no data", which is drawn as a gap rather than as zero.
 */
export interface ChartSeries {
	key: string;
	label: string;
	values: ReadonlyArray<number | null>;
	/** Overrides the palette slot this series would otherwise take. Any CSS colour. */
	color?: string;
}

/**
 * Which colour job the chart's default palette does.
 *
 * `series` encodes identity — eight fixed hues in a fixed order, never cycled, so a reader who
 * learned "Austria is blue" keeps that. `ordinal` encodes position in a sequence (draft → submitted
 * → accepted) as one hue in monotone lightness steps, so the order is visible in the colour.
 *
 * Picking the wrong one is a real error, not a style choice: an ordinal ramp on nominal categories
 * re-encodes magnitude the marks already show, and identity hues on ordered stages hide the order.
 */
export type ChartPalette = "ordinal" | "series";

/** Slot counts are a hard ceiling — a 9th series is never a generated hue. */
const paletteSize: Record<ChartPalette, number> = { ordinal: 3, series: 8 };

/**
 * Charts paint from the raw `--chart-*` tokens rather than Tailwind's `--color-*` aliases.
 *
 * The slot is chosen at runtime, so the variable name never appears literally in the source. A
 * `@theme` alias is emitted only when Tailwind can see it used, so an alias referenced this way
 * would be dropped from the build and the marks would paint with nothing. The raw tokens are plain
 * declarations in `@layer theme` and are always emitted.
 */
export function chartSeriesColor(palette: ChartPalette, index: number): string {
	const slot = (index % paletteSize[palette]) + 1;

	return `var(--chart-${palette}-${String(slot)})`;
}

export function resolveSeriesColors(
	series: ReadonlyArray<ChartSeries>,
	palette: ChartPalette,
): Array<string> {
	return series.map((item, index) => item.color ?? chartSeriesColor(palette, index));
}

export interface ChartPlotGeometry {
	height: number;
	/** Distance between the left edge and the plot area — leaves room for the y-axis labels. */
	paddingInlineStart: number;
	plotHeight: number;
	plotWidth: number;
	width: number;
}

export const chartPadding = {
	blockEnd: 26,
	blockStart: 10,
	inlineEnd: 10,
	/** Floor only — the real value grows with the widest y-axis label. */
	minInlineStart: 40,
} as const;

/** Rough width of one character of the 11px axis type; a slight overestimate on purpose. */
const axisCharWidth = 6.4;

/**
 * Room for the y-axis labels, sized to the widest one.
 *
 * A fixed gutter silently clips the leading character of a long label — "€800,000" needs half again
 * the space "20" does — and the clip only appears once real data widens the axis, which is exactly
 * when nobody is looking at the component in isolation.
 */
function axisGutter(longestLabelLength: number): number {
	return Math.max(chartPadding.minInlineStart, Math.ceil(longestLabelLength * axisCharWidth) + 14);
}

/**
 * Width of the chart in real pixels.
 *
 * Charts are laid out in pixels rather than in a scaled `viewBox`, because a scaled viewBox scales
 * its text and stroke widths with it — a chart in a narrow column would render 6px axis labels and
 * hairline-thin marks. The trade is that the width has to be measured on the client; until it is,
 * `fallback` is used, so the server render and the first paint agree on a sane layout.
 */
export function useChartWidth(ref: RefObject<HTMLElement | null>, fallback: number): number {
	const [width, setWidth] = useState(fallback);

	useLayoutEffect(() => {
		const element = ref.current;

		if (element == null) {
			return;
		}

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];

			if (entry != null) {
				setWidth(Math.max(Math.round(entry.contentRect.width), 240));
			}
		});

		observer.observe(element);

		return () => {
			observer.disconnect();
		};
	}, [ref]);

	return width;
}

/**
 * Axis ticks on human-readable numbers (0 / 500 / 1,000), not on the data's own extremes — the
 * ticks carry every value that is not directly labelled, so they have to be readable at a glance.
 */
export function chartTicks(maxValue: number, tickCount = 4): Array<number> {
	if (!Number.isFinite(maxValue) || maxValue <= 0) {
		return [0, 1];
	}

	const rawStep = maxValue / tickCount;
	const magnitude = 10 ** Math.floor(Math.log10(rawStep));
	const step =
		[1, 2, 2.5, 5, 10]
			.map((factor) => factor * magnitude)
			.find((candidate) => candidate >= rawStep) ?? 10 * magnitude;
	const ticks: Array<number> = [];

	for (let tick = 0; tick <= maxValue + step / 2; tick += step) {
		ticks.push(Number(tick.toFixed(10)));
	}

	return ticks;
}

interface ChartGridProps {
	geometry: ChartPlotGeometry;
	formatValue: (value: number) => string;
	max: number;
	ticks: ReadonlyArray<number>;
}

/**
 * Horizontal gridlines and their y-axis labels. Solid hairlines one step off the surface — dashed
 * rules read as "threshold" or "projection" when they are only a grid.
 */
export function ChartGrid(props: Readonly<ChartGridProps>): ReactNode {
	const { formatValue, geometry, max, ticks } = props;

	return (
		<g aria-hidden={true}>
			{ticks.map((tick) => {
				const y = chartPadding.blockStart + geometry.plotHeight * (1 - tick / max);

				return (
					<g key={tick}>
						<line
							stroke="var(--chart-grid)"
							strokeWidth={1}
							x1={geometry.paddingInlineStart}
							x2={geometry.paddingInlineStart + geometry.plotWidth}
							y1={y}
							y2={y}
						/>
						<text
							className="text-[11px] tabular-nums"
							fill="var(--chart-axis)"
							dominantBaseline="middle"
							textAnchor="end"
							x={geometry.paddingInlineStart - 8}
							y={y}
						>
							{formatValue(tick)}
						</text>
					</g>
				);
			})}
		</g>
	);
}

interface ChartCategoryAxisProps {
	bandWidth: number;
	categories: ReadonlyArray<string>;
	geometry: ChartPlotGeometry;
}

export function ChartCategoryAxis(props: Readonly<ChartCategoryAxisProps>): ReactNode {
	const { bandWidth, categories, geometry } = props;

	return (
		<g aria-hidden={true}>
			{categories.map((category, index) => (
				<text
					key={category}
					className="text-[11px]"
					fill="var(--chart-axis)"
					textAnchor="middle"
					x={geometry.paddingInlineStart + bandWidth * (index + 0.5)}
					y={geometry.height - 8}
				>
					{category}
				</text>
			))}
		</g>
	);
}

export interface ChartLegendItem {
	color: string;
	label: string;
}

interface ChartLegendProps {
	items: ReadonlyArray<ChartLegendItem>;
	/** Legend keys mirror the mark they stand for: a bar is a rect, a line is a line. */
	shape: "line" | "rect";
}

/**
 * Present whenever a chart draws two or more series, so identity never rests on colour alone. A
 * single series gets none — the chart's own heading already says what is plotted, and a one-swatch
 * box just restates it.
 */
export function ChartLegend(props: Readonly<ChartLegendProps>): ReactNode {
	const { items, shape } = props;

	if (items.length < 2) {
		return null;
	}

	return (
		<ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
			{items.map((item) => (
				<li key={item.label} className="flex items-center gap-x-2 text-xs text-muted-fg">
					<span
						className={
							shape === "line"
								? "block shrink-0 rounded-full block-0.5 inline-3"
								: "block shrink-0 rounded-xs block-2.5 inline-2.5"
						}
						style={{ backgroundColor: item.color }}
					/>
					{item.label}
				</li>
			))}
		</ul>
	);
}

export interface ChartTooltipRow {
	color: string;
	label: string;
	value: string;
}

export interface ChartTooltipState {
	/** Plot-space x of the hovered category's centre, in pixels. */
	x: number;
	rows: Array<ChartTooltipRow>;
	title: string;
}

interface ChartTooltipProps {
	state: ChartTooltipState | null;
	width: number;
}

/**
 * Read-out for the hovered (or keyboard-focused) category, listing every series at that position so
 * the pointer never has to land on a particular mark.
 *
 * It enhances and never gates: every number here is also in the page's table, which is why the
 * chart stays usable without a pointer at all.
 */
export function ChartTooltip(props: Readonly<ChartTooltipProps>): ReactNode {
	const { state, width } = props;

	if (state == null) {
		return null;
	}

	// Keep the card inside the chart box; past the halfway mark it flips to the other side.
	const isFlipped = state.x > width / 2;

	return (
		<div
			className="pointer-events-none absolute inset-bs-0 z-10 rounded-lg border bg-overlay p-2 text-overlay-fg shadow-md min-inline-32"
			style={
				isFlipped
					? { insetInlineEnd: `${String(width - state.x)}px`, marginInlineEnd: "8px" }
					: { insetInlineStart: `${String(state.x)}px`, marginInlineStart: "8px" }
			}
		>
			<p className="text-xs text-muted-fg">{state.title}</p>
			<ul className="mbs-1 flex flex-col gap-y-0.5">
				{state.rows.map((row) => (
					<li key={row.label} className="flex items-center gap-x-2 text-xs whitespace-nowrap">
						<span
							className="block shrink-0 rounded-full block-0.5 inline-3"
							style={{ backgroundColor: row.color }}
						/>
						{/* Values lead, labels follow — the reader already knows the series. */}
						<span className="font-semibold tabular-nums">{row.value}</span>
						<span className="text-muted-fg">{row.label}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

interface ChartHitAreasProps {
	bandWidth: number;
	categories: ReadonlyArray<string>;
	geometry: ChartPlotGeometry;
	onActivate: (index: number | null) => void;
}

/**
 * One transparent, focusable band per category, spanning the full plot height.
 *
 * The hit target is deliberately far larger than the marks: aiming at a 2px line or a short bar is
 * a pinpoint nobody hits reliably. Bands are keyboard-focusable so focus shows exactly what hover
 * shows.
 */
export function ChartHitAreas(props: Readonly<ChartHitAreasProps>): ReactNode {
	const { bandWidth, categories, geometry, onActivate } = props;

	return (
		<g>
			{categories.map((category, index) => (
				<rect
					key={category}
					className="cursor-default fill-transparent -outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-outline"
					height={geometry.plotHeight}
					onBlur={() => {
						onActivate(null);
					}}
					onFocus={() => {
						onActivate(index);
					}}
					onPointerEnter={() => {
						onActivate(index);
					}}
					onPointerLeave={() => {
						onActivate(null);
					}}
					tabIndex={0}
					width={bandWidth}
					x={geometry.paddingInlineStart + bandWidth * index}
					y={chartPadding.blockStart}
				/>
			))}
		</g>
	);
}

interface ChartFrameProps {
	"aria-label": string;
	children: ReactNode;
	className?: string;
	containerRef: RefObject<HTMLDivElement | null>;
	geometry: ChartPlotGeometry;
	legend: ReactNode;
	tooltip: ReactNode;
}

/** The outer box every chart shares: a measured container, the SVG canvas, tooltip, and legend. */
export function ChartFrame(props: Readonly<ChartFrameProps>): ReactNode {
	const {
		"aria-label": ariaLabel,
		children,
		className,
		containerRef,
		geometry,
		legend,
		tooltip,
	} = props;

	return (
		<figure className={twMerge("flex flex-col gap-y-3", className)}>
			<div ref={containerRef} className="relative inline-full">
				<svg
					aria-label={ariaLabel}
					height={geometry.height}
					role="img"
					/*
					 * Sized in real pixels from the measured container, so at steady state nothing scales
					 * and the type stays at its intended size.
					 *
					 * The cap matters for the render before that measurement exists: the server has no DOM
					 * to measure, so it emits the fallback width, and a fallback wider than the card would
					 * paint a chart overflowing into whatever sits beside it until hydration corrects it.
					 * With the cap that first paint is merely scaled down, then snaps to exact.
					 */
					style={{ height: "auto", maxWidth: "100%" }}
					width={geometry.width}
					viewBox={`0 0 ${String(geometry.width)} ${String(geometry.height)}`}
				>
					{children}
				</svg>
				{tooltip}
			</div>
			{legend}
		</figure>
	);
}

/**
 * Shared wiring for the hovered/focused category and the geometry derived from the container.
 *
 * `axisLabels` are the already-formatted y-axis ticks — the gutter is sized from the widest of
 * them, so a currency axis gets more room than a count axis without the caller thinking about it.
 */
export function useChartGeometry(
	fallbackWidth: number,
	height: number,
	axisLabels: ReadonlyArray<string>,
): {
	activeIndex: number | null;
	containerRef: RefObject<HTMLDivElement | null>;
	geometry: ChartPlotGeometry;
	setActiveIndex: (index: number | null) => void;
} {
	const containerRef = useRef<HTMLDivElement>(null);
	const width = useChartWidth(containerRef, fallbackWidth);
	const [activeIndex, setActiveIndex] = useState<number | null>(null);

	const handleActivate = useCallback((index: number | null) => {
		setActiveIndex(index);
	}, []);

	// A filter change can shorten the category list while a band is hovered.
	useEffect(() => {
		setActiveIndex(null);
	}, [width]);

	const paddingInlineStart = axisGutter(Math.max(...axisLabels.map((label) => label.length), 0));

	return {
		activeIndex,
		containerRef,
		geometry: {
			height,
			paddingInlineStart,
			plotHeight: height - chartPadding.blockStart - chartPadding.blockEnd,
			plotWidth: width - paddingInlineStart - chartPadding.inlineEnd,
			width,
		},
		setActiveIndex: handleActivate,
	};
}
