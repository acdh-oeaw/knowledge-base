"use client";

import { type CropFrame, getCropFrame, getCropOverlap } from "@dariah-eric/images/crop";
import { Button } from "@dariah-eric/ui/button";
import { descriptionStyles, labelStyles } from "@dariah-eric/ui/field";
import { useExtracted } from "next-intl";
import {
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	type SyntheticEvent,
	useId,
	useRef,
	useState,
} from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { twJoin } from "tailwind-merge";

import {
	type FocalPoint,
	type PreviewCrop,
	centreFocalPoint,
	clampFocalPoint,
	formatFocalPointInput,
	toObjectPosition,
	toPercent,
} from "@/lib/focal-point";

/** Outlines what every crop keeps, where there is more than one. */
const allCrops = "all";

/** Arrow keys move the point by this much, or by a tenth of it with shift held. */
const keyboardStep = 0.05;

interface FocalPointFieldProps {
	alt: string;
	/** The shapes the image is cropped to (see `getPreviewCrops`). */
	crops: ReadonlyArray<PreviewCrop>;
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
	const { alt, crops, defaultValue, name, src } = props;

	const t = useExtracted();
	const labelId = useId();
	const descriptionId = useId();
	const imageRef = useRef<HTMLImageElement>(null);
	const [point, setPoint] = useState<FocalPoint | null>(defaultValue);
	/** Unknown until the image has loaded, and every crop frame depends on it. */
	const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
	const hasOverlap = crops.length > 1;
	/** The safe area first, where there is one: where text and faces stay visible on every page. */
	const [outlinedCrop, setOutlinedCrop] = useState<string | null>(
		hasOverlap ? allCrops : (crops[0]?.id ?? null),
	);

	const current = point ?? centreFocalPoint;

	const frames =
		imageAspectRatio != null
			? crops.map((crop) => {
					return {
						id: crop.id,
						frame: getCropFrame({
							cropAspectRatio: crop.aspectRatio,
							focalPoint: current,
							imageAspectRatio,
						}),
					};
				})
			: null;
	const overlap = frames != null ? getCropOverlap(frames.map(({ frame }) => frame)) : null;

	function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
		const image = event.currentTarget;
		/** A vector without intrinsic dimensions reports zero; its rendered box has the same shape. */
		const width = image.naturalWidth > 0 ? image.naturalWidth : image.clientWidth;
		const height = image.naturalHeight > 0 ? image.naturalHeight : image.clientHeight;

		setImageAspectRatio(width > 0 && height > 0 ? width / height : null);
	}

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

	/** The part left undimmed, and the crops drawn as dashed outlines around it. */
	const highlightedFrame =
		outlinedCrop === allCrops
			? overlap
			: (frames?.find((entry) => entry.id === outlinedCrop)?.frame ?? null);
	const dashedFrames = outlinedCrop === allCrops && frames != null ? frames : [];
	/** The overlap's own shape, in pixels rather than fractions, for its thumbnail. */
	const overlapAspectRatio =
		overlap != null && imageAspectRatio != null && overlap.height > 0
			? (overlap.width * imageAspectRatio) / overlap.height
			: 1;

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
						onLoad={handleImageLoad}
						src={src}
					/>
					{highlightedFrame != null ? (
						/* Everything cut off is dimmed by the highlighted frame's own shadow, clipped to the
						   image, so the part that stays reads as a window onto it. */
						<span
							aria-hidden={true}
							className="pointer-events-none absolute inset-0 overflow-hidden rounded-sm"
						>
							{dashedFrames.map(({ id, frame }) => (
								<span
									key={id}
									className="absolute border border-dashed border-white/70"
									style={toFrameBox(frame)}
								/>
							))}
							<span
								className="absolute shadow-[0_0_0_9999px_rgb(0_0_0/0.5)] outline-2 -outline-offset-1 outline-white"
								style={toFrameBox(highlightedFrame)}
							/>
						</span>
					) : null}
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

			{/* The thumbnails double as the switch for which crop is outlined on the image above: they
			    show every crop at once, the outline shows what each one leaves out. Each grows with its
			    shape, so they all come out the same height. */}
			<ToggleButtonGroup
				aria-label={t("Crop outlined on the image")}
				className="flex flex-row items-end gap-2"
				onSelectionChange={(keys) => {
					const [crop] = [...keys] as Array<string>;
					setOutlinedCrop(crop ?? null);
				}}
				selectedKeys={outlinedCrop != null ? [outlinedCrop] : []}
				selectionMode="single"
			>
				{crops.map((crop) => (
					<CropThumbnail key={crop.id} aspectRatio={crop.aspectRatio} id={crop.id} label={crop.id}>
						{/* Cropped by the browser exactly as the website crops it. */}
						<img
							alt=""
							className="object-cover block-full inline-full"
							draggable={false}
							src={src}
							style={{ objectPosition: toObjectPosition(current) }}
						/>
					</CropThumbnail>
				))}
				{hasOverlap ? (
					<CropThumbnail aspectRatio={overlapAspectRatio} id={allCrops} label={t("All crops")}>
						{overlap != null ? (
							<img
								alt=""
								className="absolute"
								draggable={false}
								src={src}
								style={toCroppedImageBox(overlap)}
							/>
						) : null}
					</CropThumbnail>
				) : null}
			</ToggleButtonGroup>
		</div>
	);
}

interface CropThumbnailProps {
	aspectRatio: number;
	children: ReactNode;
	id: string;
	label: string;
}

function CropThumbnail(props: Readonly<CropThumbnailProps>): ReactNode {
	const { aspectRatio, children, id, label } = props;

	return (
		<ToggleButton
			className={({ isFocusVisible, isHovered, isSelected }) =>
				twJoin(
					"flex basis-0 cursor-default flex-col gap-y-1 rounded-sm text-xs text-muted-fg outline-2 outline-offset-2 outline-transparent min-inline-0",
					isHovered && "text-fg",
					isSelected && "font-medium text-fg",
					isFocusVisible && "outline-focus-outline",
				)
			}
			id={id}
			style={{ flexGrow: aspectRatio }}
		>
			{({ isSelected }) => (
				<>
					<span
						className={twJoin(
							"relative block overflow-hidden rounded-sm bg-muted",
							isSelected && "ring-2 ring-fg",
						)}
						style={{ aspectRatio }}
					>
						{children}
					</span>
					<span className="truncate text-center">{label}</span>
				</>
			)}
		</ToggleButton>
	);
}

/** Places a crop frame over the whole image it was cut from. */
function toFrameBox(frame: CropFrame): CSSProperties {
	return {
		left: toPercent(frame.x),
		top: toPercent(frame.y),
		width: toPercent(frame.width),
		height: toPercent(frame.height),
	};
}

/**
 * Scales and shifts the whole image inside a box the shape of a frame, so the box shows exactly
 * that part. For a frame no single `object-position` describes, like the overlap of all crops.
 */
function toCroppedImageBox(frame: CropFrame): CSSProperties {
	return {
		left: toPercent(-frame.x / frame.width),
		top: toPercent(-frame.y / frame.height),
		width: toPercent(1 / frame.width),
		height: toPercent(1 / frame.height),
		/** Preflight caps images at their container's width, which is exactly what this overflows. */
		maxWidth: "none",
	};
}
