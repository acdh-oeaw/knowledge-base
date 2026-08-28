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

export interface LineChartProps {
	"aria-label": string;
	categories: ReadonlyArray<string>;
	className?: string;
	/** Formats values in the tooltip and on the y-axis. */
	formatValue?: (value: number) => string;
	height?: number;
	palette?: ChartPalette;
	series: ReadonlyArray<ChartSeries>;
}

const strokeWidth = 2;
const markerRadius = 4;

/**
 * A trend over an ordered categorical x-axis.
 *
 * Every series shares one y-axis on purpose. Two measures of different magnitude never get a second
 * scale — the alignment between two axes is arbitrary, so a dual-axis chart invents a correlation
 * that is not in the data. Plot them as two charts, or index both to a common base.
 */
export function LineChart(props: Readonly<LineChartProps>): ReactNode {
	const {
		"aria-label": ariaLabel,
		categories,
		className,
		formatValue = String,
		height = 240,
		palette = "series",
		series,
	} = props;

	const colors = resolveSeriesColors(series, palette);

	const maxValue = Math.max(
		...series.flatMap((item) => item.values.map((value) => Math.max(value ?? 0, 0))),
		0,
	);
	const ticks = chartTicks(maxValue);
	const axisMax = ticks.at(-1) ?? 1;

	// The axis labels decide how wide the gutter has to be, so they are resolved before the geometry.
	const { activeIndex, containerRef, geometry, setActiveIndex } = useChartGeometry(
		720,
		height,
		ticks.map((tick) => formatValue(tick)),
	);
	const bandWidth = geometry.plotWidth / Math.max(categories.length, 1);
	// Points sit at band centres so they line up with the category labels beneath them.
	const toX = (index: number) => geometry.paddingInlineStart + bandWidth * (index + 0.5);
	const toY = (value: number) =>
		chartPadding.blockStart + geometry.plotHeight * (1 - value / axisMax);

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
					x: toX(activeIndex),
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
					shape="line"
				/>
			}
			tooltip={<ChartTooltip state={tooltip} width={geometry.width} />}
		>
			<ChartGrid formatValue={formatValue} geometry={geometry} max={axisMax} ticks={ticks} />

			{/* The crosshair finds the x, so the reader aims at a year rather than at a 2px line. */}
			{activeIndex != null && (
				<line
					aria-hidden={true}
					stroke="var(--chart-axis)"
					strokeWidth={1}
					x1={toX(activeIndex)}
					x2={toX(activeIndex)}
					y1={chartPadding.blockStart}
					y2={chartPadding.blockStart + geometry.plotHeight}
				/>
			)}

			{series.map((item, seriesIndex) => {
				const color = colors[seriesIndex] ?? "currentColor";
				// A gap in the data is a gap in the line — never a drop to zero, which would read as a
				// real measurement. Each run of consecutive values becomes its own path.
				const runs: Array<Array<{ index: number; value: number }>> = [];
				let run: Array<{ index: number; value: number }> | null = null;

				categories.forEach((_category, index) => {
					const value = item.values[index];

					if (value == null) {
						run = null;
						return;
					}

					if (run == null) {
						run = [];
						runs.push(run);
					}

					run.push({ index, value });
				});

				return (
					<g key={item.key}>
						{runs
							.filter((run) => run.length > 1)
							.map((run) => (
								<path
									key={run[0]?.index}
									d={run
										.map(
											(point, pointIndex) =>
												`${pointIndex === 0 ? "M" : "L"} ${String(toX(point.index))} ${String(toY(point.value))}`,
										)
										.join(" ")}
									fill="none"
									stroke={color}
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={strokeWidth}
								/>
							))}
						{runs.flat().map((point) => (
							<circle
								key={point.index}
								cx={toX(point.index)}
								cy={toY(point.value)}
								fill={color}
								r={activeIndex === point.index ? markerRadius + 1 : markerRadius}
								// A 2px ring in the surface colour keeps overlapping markers legible.
								stroke="var(--bg)"
								strokeWidth={2}
							/>
						))}
					</g>
				);
			})}

			{/* A lone series is direct-labelled at its end, so the headline value needs no hover. */}
			{series.length === 1 &&
				series.map((item) => {
					const lastIndex = item.values.findLastIndex((value) => value != null);
					const lastValue = item.values[lastIndex];

					if (lastIndex < 0 || lastValue == null) {
						return null;
					}

					return (
						<text
							key={item.key}
							className="fill-fg text-[11px] font-semibold tabular-nums"
							textAnchor="end"
							x={toX(lastIndex)}
							y={toY(lastValue) - 12}
						>
							{formatValue(lastValue)}
						</text>
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
