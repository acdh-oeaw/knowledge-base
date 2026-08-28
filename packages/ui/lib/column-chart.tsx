"use client";

import type { ReactNode } from "react";

import {
	ChartCategoryAxis,
	ChartFrame,
	ChartGrid,
	ChartHitAreas,
	ChartLegend,
	type ChartPalette,
	type ChartSeries,
	ChartTooltip,
	type ChartTooltipState,
	chartPadding,
	chartTicks,
	resolveSeriesColors,
	useChartGeometry,
} from "./chart";

export interface ColumnChartProps {
	"aria-label": string;
	categories: ReadonlyArray<string>;
	className?: string;
	/** Formats values in the tooltip and on the y-axis. */
	formatValue?: (value: number) => string;
	height?: number;
	palette?: ChartPalette;
	series: ReadonlyArray<ChartSeries>;
	/** Stack the series into one column per category instead of placing them side by side. */
	stacked?: boolean;
}

/** Marks stay thin — a column never fills its band, and the leftover is air. */
const maxColumnWidth = 24;
/** Surface showing through is what separates touching marks; a stroke around them would not. */
const surfaceGap = 2;
const cornerRadius = 4;

/**
 * A column with a rounded cap and a square foot: the rounding marks the data end, while the
 * baseline stays flat so the reader compares heights against a straight edge. Interior segments of
 * a stack pass `radius: 0` — only the top of the whole column is a data end.
 */
function columnPath(x: number, y: number, width: number, height: number, radius: number): string {
	const r = Math.max(Math.min(radius, width / 2, height), 0);
	const right = x + width;
	const bottom = y + height;

	if (r === 0) {
		return `M ${String(x)} ${String(y)} H ${String(right)} V ${String(bottom)} H ${String(x)} Z`;
	}

	return [
		`M ${String(x)} ${String(bottom)}`,
		`V ${String(y + r)}`,
		`Q ${String(x)} ${String(y)} ${String(x + r)} ${String(y)}`,
		`H ${String(right - r)}`,
		`Q ${String(right)} ${String(y)} ${String(right)} ${String(y + r)}`,
		`V ${String(bottom)}`,
		"Z",
	].join(" ");
}

/**
 * Columns over a categorical x-axis — the default form for comparing magnitude across a handful of
 * discrete periods or groups.
 *
 * Use `stacked` for part-to-whole (the segments sum to something meaningful); leave it off to
 * compare series against each other. Values are also expected to appear in a table nearby: the
 * tooltip is an enhancement, never the only way to read a number.
 */
export function ColumnChart(props: Readonly<ColumnChartProps>): ReactNode {
	const {
		"aria-label": ariaLabel,
		categories,
		className,
		formatValue = String,
		height = 240,
		palette = "series",
		series,
		stacked = false,
	} = props;

	const colors = resolveSeriesColors(series, palette);

	const maxValue = stacked
		? Math.max(
				...categories.map((_category, index) =>
					series.reduce((sum, item) => sum + Math.max(item.values[index] ?? 0, 0), 0),
				),
				0,
			)
		: Math.max(...series.flatMap((item) => item.values.map((value) => Math.max(value ?? 0, 0))), 0);
	const ticks = chartTicks(maxValue);
	const axisMax = ticks.at(-1) ?? 1;

	// The axis labels decide how wide the gutter has to be, so they are resolved before the geometry.
	const { activeIndex, containerRef, geometry, setActiveIndex } = useChartGeometry(
		720,
		height,
		ticks.map((tick) => formatValue(tick)),
	);
	const bandWidth = geometry.plotWidth / Math.max(categories.length, 1);
	const baseline = chartPadding.blockStart + geometry.plotHeight;

	const groupCount = stacked ? 1 : series.length;
	const columnWidth = Math.max(
		2,
		Math.min(
			maxColumnWidth,
			(bandWidth - 12 - surfaceGap * (groupCount - 1)) / Math.max(groupCount, 1),
		),
	);
	const groupWidth = columnWidth * groupCount + surfaceGap * (groupCount - 1);

	const tooltip: ChartTooltipState | null =
		activeIndex == null
			? null
			: {
					rows: series.map((item, seriesIndex) => {
						return {
							color: colors[seriesIndex] ?? "currentColor",
							label: item.label,
							value: formatValue(item.values[activeIndex] ?? 0),
						};
					}),
					title: categories[activeIndex] ?? "",
					x: geometry.paddingInlineStart + bandWidth * (activeIndex + 0.5),
				};

	return (
		<ChartFrame
			aria-label={ariaLabel}
			className={className}
			containerRef={containerRef}
			geometry={geometry}
			legend={
				<ChartLegend
					items={series.map((item, index) => {
						return {
							color: colors[index] ?? "currentColor",
							label: item.label,
						};
					})}
					shape="rect"
				/>
			}
			tooltip={<ChartTooltip state={tooltip} width={geometry.width} />}
		>
			<ChartGrid formatValue={formatValue} geometry={geometry} max={axisMax} ticks={ticks} />

			{categories.map((category, index) => {
				const bandStart = geometry.paddingInlineStart + bandWidth * index;
				const groupStart = bandStart + (bandWidth - groupWidth) / 2;
				// Only the last drawn segment of a stack is a data end, so only it gets the rounded cap.
				const topSeriesIndex = series.findLastIndex((item) => (item.values[index] ?? 0) > 0);
				let stackedOffset = 0;

				return (
					<g
						key={category}
						className={
							activeIndex != null && activeIndex !== index
								? "opacity-60 transition-opacity"
								: "opacity-100 transition-opacity"
						}
					>
						{series.map((item, seriesIndex) => {
							const value = item.values[index] ?? 0;

							if (value <= 0) {
								return null;
							}

							const segmentHeight = (value / axisMax) * geometry.plotHeight;
							const x = stacked
								? groupStart
								: groupStart + (columnWidth + surfaceGap) * seriesIndex;
							const top = stacked
								? baseline - stackedOffset - segmentHeight
								: baseline - segmentHeight;
							const isTopOfStack = !stacked || seriesIndex === topSeriesIndex;

							// A stacked segment under another one gives up 2px at its top, so the surface
							// itself separates the two. The lowest segment keeps its foot on the baseline.
							const inset = isTopOfStack ? 0 : Math.min(surfaceGap, segmentHeight);
							const drawnHeight = segmentHeight - inset;

							stackedOffset += segmentHeight;

							if (drawnHeight <= 0) {
								return null;
							}

							return (
								<path
									key={item.key}
									d={columnPath(
										x,
										top + inset,
										columnWidth,
										drawnHeight,
										isTopOfStack ? cornerRadius : 0,
									)}
									fill={colors[seriesIndex] ?? "currentColor"}
								/>
							);
						})}
					</g>
				);
			})}

			<ChartCategoryAxis bandWidth={bandWidth} categories={categories} geometry={geometry} />
			<ChartHitAreas
				bandWidth={bandWidth}
				categories={categories}
				geometry={geometry}
				onActivate={setActiveIndex}
			/>
		</ChartFrame>
	);
}
