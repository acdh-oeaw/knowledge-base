"use client";

import { Button } from "@dariah-eric/ui/button";
import { descriptionStyles, labelStyles } from "@dariah-eric/ui/field";
import { useExtracted } from "next-intl";
import {
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	useId,
	useRef,
	useState,
} from "react";

import {
	type FocalPoint,
	centreFocalPoint,
	clampFocalPoint,
	formatFocalPointInput,
	toObjectPosition,
	toPercent,
} from "@/lib/focal-point";

/**
 * The shapes the website crops featured images to: the mobile card, the desktop banner, and a
 * square for avatars and grid tiles. Previewing them is what lets an editor judge a point — the
 * crosshair alone does not show what gets cut off.
 */
const previewAspectRatios = [
	{ label: "1:1", value: 1 },
	{ label: "4:3", value: 4 / 3 },
	{ label: "8:3", value: 8 / 3 },
] as const;

/** Arrow keys move the point by this much, or by a tenth of it with shift held. */
const keyboardStep = 0.05;

interface FocalPointFieldProps {
	alt: string;
	defaultValue: FocalPoint | null;
	name: string;
	src: string;
}

/**
 * Picks the point of an image to keep in view wherever it is cropped. Click or drag on the image to
 * place it, or focus the image and use the arrow keys. The value travels in one hidden input (see
 * `formatFocalPointInput`), so the field always submits — "reset" is sent as an explicit `"none"`.
 */
export function FocalPointField(props: Readonly<FocalPointFieldProps>): ReactNode {
	const { alt, defaultValue, name, src } = props;

	const t = useExtracted();
	const labelId = useId();
	const descriptionId = useId();
	const imageRef = useRef<HTMLImageElement>(null);
	const [point, setPoint] = useState<FocalPoint | null>(defaultValue);

	const current = point ?? centreFocalPoint;

	function setPointFromPointer(event: PointerEvent<HTMLElement>) {
		const rect = imageRef.current?.getBoundingClientRect();

		if (rect == null || rect.width === 0 || rect.height === 0) {
			return;
		}

		setPoint(
			clampFocalPoint({
				x: (event.clientX - rect.left) / rect.width,
				y: (event.clientY - rect.top) / rect.height,
			}),
		);
	}

	function handlePointerDown(event: PointerEvent<HTMLElement>) {
		if (event.button !== 0) {
			return;
		}

		/** Captured so a drag that leaves the image keeps steering the point, clamped to its edge. */
		event.currentTarget.setPointerCapture(event.pointerId);
		setPointFromPointer(event);
	}

	function handlePointerMove(event: PointerEvent<HTMLElement>) {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			setPointFromPointer(event);
		}
	}

	function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
		const step = event.shiftKey ? keyboardStep / 10 : keyboardStep;
		const deltas: Partial<Record<string, [number, number]>> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step],
			ArrowDown: [0, step],
		};
		const delta = deltas[event.key];

		if (delta == null) {
			return;
		}

		event.preventDefault();
		setPoint(clampFocalPoint({ x: current.x + delta[0], y: current.y + delta[1] }));
	}

	const position = t("{x}% from the left, {y}% from the top", {
		x: String(Math.round(current.x * 100)),
		y: String(Math.round(current.y * 100)),
	});

	return (
		<div className="flex flex-col gap-y-3">
			<input name={name} type="hidden" value={formatFocalPointInput(point)} />

			<div className="flex flex-col gap-y-1">
				<span className={labelStyles()} id={labelId}>
					{t("Focal point")}
				</span>
				<p className={descriptionStyles()} id={descriptionId}>
					{t(
						"Click the part of the image that must stay visible when it is cropped. Use the arrow keys to move it.",
					)}
				</p>
			</div>

			<div className="flex justify-center rounded-lg bg-muted p-2">
				{/* A slider, because no role describes a two-dimensional one: the value text states both
				    coordinates, which is what a screen reader announces. `touch-none` so dragging on a
				    touch screen moves the point instead of scrolling the dialog. The crosshair is placed
				    against the image itself, not this box, which is wider than a portrait image — and
				    with physical `left`/`top`, since the image does not mirror in a right-to-left page. */}
				<div
					aria-describedby={descriptionId}
					aria-labelledby={labelId}
					aria-roledescription={t("focal point picker")}
					aria-valuemax={100}
					aria-valuemin={0}
					aria-valuenow={Math.round(current.x * 100)}
					aria-valuetext={position}
					className="relative cursor-crosshair touch-none rounded-sm outline-2 outline-offset-2 outline-transparent focus-visible:outline-focus-outline"
					onKeyDown={handleKeyDown}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					role="slider"
					tabIndex={0}
				>
					<img
						ref={imageRef}
						alt={alt}
						className="block select-none max-block-72 max-inline-full"
						draggable={false}
						src={src}
					/>
					<span
						aria-hidden={true}
						className="pointer-events-none absolute -translate-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.6)] block-6 inline-6"
						style={{ left: toPercent(current.x), top: toPercent(current.y) }}
					/>
				</div>
			</div>

			<div className="flex flex-row flex-wrap items-center justify-between gap-2">
				<span aria-live="polite" className="text-xs text-muted-fg">
					{point != null ? position : t("Centre (default)")}
				</span>
				<Button
					intent="plain"
					isDisabled={point == null}
					onPress={() => {
						setPoint(null);
					}}
					size="sm"
				>
					{t("Reset to centre")}
				</Button>
			</div>

			<div className="grid grid-cols-[1fr_1.33fr_2.67fr] items-end gap-2">
				{previewAspectRatios.map((preview) => (
					<figure key={preview.label} className="flex flex-col gap-y-1">
						<div
							className="overflow-hidden rounded-sm bg-muted"
							style={{ aspectRatio: preview.value }}
						>
							<img
								alt=""
								className="object-cover block-full inline-full"
								src={src}
								style={{ objectPosition: toObjectPosition(current) }}
							/>
						</div>
						<figcaption className="text-center text-xs text-muted-fg">{preview.label}</figcaption>
					</figure>
				))}
			</div>
		</div>
	);
}
