"use client";

import { type Editor, Extension } from "@tiptap/core";
import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import {
	type ComponentType,
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";

/** The `/query` text range which opened the menu. */
export interface SlashCommandTrigger {
	from: number;
	to: number;
	query: string;
}

export interface SlashCommandItem {
	id: string;
	label: string;
	/** Extra words the query may match, so `/ul` finds "Bullet list" as well as `/bul` does. */
	keywords?: Array<string>;
	icon: ComponentType<{ className?: string }>;
	/** Hides the item when the command cannot run where the cursor is, e.g. a table inside a table. */
	isAvailable?: () => boolean;
	run: () => void;
}

/**
 * The bridge between the ProseMirror plugin and the React menu. The plugin is built before the menu
 * component exists, so it reaches the current handlers through a ref rather than through options.
 */
export interface SlashCommandHandlers {
	onTriggerChange: (trigger: SlashCommandTrigger | null) => void;
	/** Returns whether the key was consumed, so unhandled keys still reach the editor. */
	onKeyDown: (event: KeyboardEvent) => boolean;
}

interface SlashCommandPluginState {
	trigger: SlashCommandTrigger | null;
	/** Start of a token dismissed with Escape; suppressed until the author leaves or retypes it. */
	dismissedFrom: number | null;
}

const slashCommandPluginKey = new PluginKey<SlashCommandPluginState>("slashCommand");

/**
 * The `/query` token immediately before an empty cursor, if there is one.
 *
 * Read back out of the document on every transaction instead of tracked as a live range: backspace,
 * undo and programmatic edits then all resolve to the same answer with no bookkeeping to get
 * wrong.
 */
function readTrigger(state: EditorState): SlashCommandTrigger | null {
	const { selection } = state;

	if (!selection.empty) {
		return null;
	}

	const { $from } = selection;

	/** Code blocks take `/` literally, so a menu there would fight the author. */
	if (!$from.parent.isTextblock || $from.parent.type.spec.code === true) {
		return null;
	}

	/**
	 * The placeholder keeps inline atoms one character wide, so offsets into this string stay in step
	 * with document positions.
	 */
	const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
	const match = /(?:^|\s)(\/([^\s/]*))$/.exec(textBefore);
	const token = match?.[1];
	const query = match?.[2];

	if (token == null || query == null) {
		return null;
	}

	return { from: $from.pos - token.length, to: $from.pos, query };
}

function isSameTrigger(a: SlashCommandTrigger | null, b: SlashCommandTrigger | null): boolean {
	if (a == null || b == null) {
		return a === b;
	}

	return a.from === b.from && a.to === b.to && a.query === b.query;
}

/**
 * Whether a node of this type can go where the cursor is — the cursor's own parent or, failing
 * that, any ancestor a block can be split out to.
 *
 * Without this the menu would offer blocks the schema then refuses: a media and text body holds
 * only paragraphs and lists, and a table cell holds no table.
 */
export function canInsertBlock(editor: Editor, typeName: string): boolean {
	const type = editor.schema.nodes[typeName];

	if (type == null) {
		return false;
	}

	const { $from } = editor.state.selection;

	for (let depth = $from.depth; depth >= 0; depth -= 1) {
		const index = $from.index(depth);

		if ($from.node(depth).canReplaceWith(index, index, type)) {
			return true;
		}
	}

	return false;
}

/**
 * Watches for a `/query` token and drives the menu below. Adds no node or mark types, so the schema
 * stays identical to the one the read-only renderer builds.
 */
export function createSlashCommandExtension(
	handlersRef: RefObject<SlashCommandHandlers | null>,
): Extension {
	return Extension.create({
		name: "slashCommand",

		addProseMirrorPlugins() {
			return [
				new Plugin<SlashCommandPluginState>({
					key: slashCommandPluginKey,

					state: {
						init() {
							return { trigger: null, dismissedFrom: null };
						},

						apply(tr, value, _oldState, newState) {
							const meta = tr.getMeta(slashCommandPluginKey) as { dismiss?: boolean } | undefined;

							if (meta?.dismiss === true) {
								return { trigger: null, dismissedFrom: value.trigger?.from ?? null };
							}

							const trigger = readTrigger(newState);

							if (trigger == null) {
								return { trigger: null, dismissedFrom: null };
							}

							/** Escape closes the menu for this token only; a new `/` opens it again. */
							if (value.dismissedFrom === trigger.from) {
								return { trigger: null, dismissedFrom: value.dismissedFrom };
							}

							return { trigger, dismissedFrom: null };
						},
					},

					props: {
						handleKeyDown(view, event) {
							if (slashCommandPluginKey.getState(view.state)?.trigger == null) {
								return false;
							}

							if (event.key === "Escape") {
								view.dispatch(view.state.tr.setMeta(slashCommandPluginKey, { dismiss: true }));
								return true;
							}

							return handlersRef.current?.onKeyDown(event) ?? false;
						},
					},

					view() {
						return {
							update(view, prevState) {
								const previous = slashCommandPluginKey.getState(prevState)?.trigger ?? null;
								const next = slashCommandPluginKey.getState(view.state)?.trigger ?? null;

								if (!isSameTrigger(previous, next)) {
									handlersRef.current?.onTriggerChange(next);
								}
							},

							destroy() {
								handlersRef.current?.onTriggerChange(null);
							},
						};
					},
				}),
			];
		},
	});
}

/**
 * Items whose label or keywords match the query, prefix matches first. Ties keep the order the
 * items were declared in, which is the order the toolbar offers them in.
 */
function matchItems(
	items: ReadonlyArray<SlashCommandItem>,
	query: string,
): Array<SlashCommandItem> {
	const available = items.filter((item) => item.isAvailable?.() !== false);
	const needle = query.trim().toLowerCase();

	if (needle === "") {
		return available;
	}

	const scored: Array<{ item: SlashCommandItem; score: number }> = [];

	for (const item of available) {
		const haystacks = [item.label, ...(item.keywords ?? [])].map((value) => value.toLowerCase());

		let score = 0;

		for (const haystack of haystacks) {
			if (haystack.startsWith(needle)) {
				score = 2;
				break;
			}

			if (haystack.includes(needle)) {
				score = 1;
			}
		}

		if (score > 0) {
			scored.push({ item, score });
		}
	}

	return scored.toSorted((a, z) => z.score - a.score).map((entry) => entry.item);
}

/** Menu height cap, kept in step with `max-block-72` below so placement can be decided up front. */
const menuMaxBlockSize = 288;

/**
 * Physical rather than logical properties, unlike the rest of the styling here: every value is a
 * viewport measurement taken from `coordsAtPos`, which reports `left`/`top` whatever the writing
 * direction — feeding those to `inset-inline-start` would place the menu on the wrong side in RTL.
 */
interface MenuPosition {
	left: number;
	top?: number;
	bottom?: number;
}

interface SlashCommandMenuProps {
	editor: Editor;
	handlersRef: RefObject<SlashCommandHandlers | null>;
	items: ReadonlyArray<SlashCommandItem>;
	label: string;
	emptyLabel: string;
}

/**
 * The menu itself. Always mounted so it can install its handlers, and renders nothing until the
 * author types `/`.
 *
 * It portals to the body and positions itself against the caret: the editor's own container is
 * `overflow-clip`, which would otherwise cut the menu off near the bottom of a short editor.
 */
export function SlashCommandMenu(props: Readonly<SlashCommandMenuProps>): ReactNode {
	const { editor, handlersRef, items, label, emptyLabel } = props;

	const [trigger, setTrigger] = useState<SlashCommandTrigger | null>(null);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [position, setPosition] = useState<MenuPosition | null>(null);

	const listRef = useRef<HTMLDivElement | null>(null);
	const listboxId = useId();
	const optionId = useCallback((index: number) => `${listboxId}-${String(index)}`, [listboxId]);

	const matched = useMemo(
		() => (trigger == null ? [] : matchItems(items, trigger.query)),
		[items, trigger],
	);

	/** The query can shrink the list out from under the selection between renders. */
	const activeIndex = matched.length === 0 ? -1 : Math.min(selectedIndex, matched.length - 1);

	const run = useCallback(
		(item: SlashCommandItem) => {
			if (trigger == null) {
				return;
			}

			/** Take the `/query` back out before the command inserts anything in its place. */
			editor.chain().focus().deleteRange({ from: trigger.from, to: trigger.to }).run();
			item.run();
		},
		[editor, trigger],
	);

	/**
	 * Re-installed on every render rather than keyed to a dependency list: the key handler closes
	 * over the matched items and the selected index, both of which change as the author types.
	 */
	useLayoutEffect(() => {
		handlersRef.current = {
			onTriggerChange(next) {
				setTrigger(next);
				setSelectedIndex(0);
			},

			onKeyDown(event) {
				if (matched.length === 0) {
					return false;
				}

				switch (event.key) {
					case "ArrowDown": {
						setSelectedIndex((activeIndex + 1) % matched.length);
						return true;
					}

					case "ArrowUp": {
						setSelectedIndex((activeIndex - 1 + matched.length) % matched.length);
						return true;
					}

					case "Enter":
					case "Tab": {
						const item = matched[activeIndex];

						if (item == null) {
							return false;
						}

						run(item);
						return true;
					}

					default: {
						return false;
					}
				}
			},
		};

		return () => {
			handlersRef.current = null;
		};
	});

	useLayoutEffect(() => {
		if (trigger == null) {
			setPosition(null);
			return;
		}

		function reposition() {
			/** A stale trigger would make `coordsAtPos` throw and take the editor down with it. */
			if (trigger == null || trigger.from > editor.state.doc.content.size) {
				setPosition(null);
				return;
			}

			const coords = editor.view.coordsAtPos(trigger.from);
			const spaceBelow = window.innerHeight - coords.bottom;

			setPosition(
				spaceBelow < menuMaxBlockSize && coords.top > spaceBelow
					? { left: coords.left, bottom: window.innerHeight - coords.top + 4 }
					: { left: coords.left, top: coords.bottom + 4 },
			);
		}

		reposition();

		/** Capture, so scrolling any ancestor of the editor moves the menu with the caret. */
		window.addEventListener("scroll", reposition, true);
		window.addEventListener("resize", reposition);

		return () => {
			window.removeEventListener("scroll", reposition, true);
			window.removeEventListener("resize", reposition);
		};
	}, [editor, trigger]);

	useEffect(() => {
		listRef.current
			?.querySelector(`[data-index="${String(activeIndex)}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	/**
	 * Focus stays in the editor while the menu is open, so the editor is what has to point a screen
	 * reader at the highlighted option.
	 */
	useEffect(() => {
		const element = editor.view.dom;
		const isOpen = trigger != null;

		element.setAttribute("aria-expanded", String(isOpen));

		if (isOpen && activeIndex >= 0) {
			element.setAttribute("aria-controls", listboxId);
			element.setAttribute("aria-activedescendant", optionId(activeIndex));
		} else {
			element.removeAttribute("aria-controls");
			element.removeAttribute("aria-activedescendant");
		}

		return () => {
			element.removeAttribute("aria-expanded");
			element.removeAttribute("aria-controls");
			element.removeAttribute("aria-activedescendant");
		};
	}, [editor, trigger, activeIndex, listboxId, optionId]);

	if (trigger == null || position == null || typeof document === "undefined") {
		return null;
	}

	return createPortal(
		<div
			aria-label={label}
			className="fixed z-50 overflow-y-auto rounded-lg border border-border bg-bg py-1 shadow-lg inline-64 max-block-72"
			id={listboxId}
			ref={listRef}
			role="listbox"
			style={{ left: position.left, top: position.top, bottom: position.bottom }}
		>
			{matched.length === 0 ? (
				<p className="px-3 py-2 text-sm text-muted-fg">{emptyLabel}</p>
			) : (
				matched.map((item, index) => (
					<button
						aria-selected={index === activeIndex}
						className={twMerge(
							"flex cursor-pointer items-center gap-x-2 px-3 py-1.5 text-start text-sm text-fg transition-colors inline-full",
							index === activeIndex && "bg-primary-subtle/50",
						)}
						data-index={index}
						id={optionId(index)}
						key={item.id}
						onClick={() => {
							run(item);
						}}
						/** Keep the editor focused, so the command lands on the caret it was typed at. */
						onPointerDown={(event) => {
							event.preventDefault();
						}}
						role="option"
						type="button"
					>
						<item.icon className="shrink-0 text-muted-fg block-4 inline-4" />
						{item.label}
					</button>
				))
			)}
		</div>,
		document.body,
	);
}
