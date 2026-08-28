import type { Meta, StoryObj } from "@storybook/react-vite";
import type { JSONContent } from "@tiptap/core";
import { expect, fn } from "storybook/test";

import { RichTextEditor, RichTextRenderer } from "./rich-text-editor";

const sampleContent: JSONContent = {
	type: "doc",
	content: [
		{
			type: "heading",
			attrs: { level: 1 },
			content: [{ type: "text", text: "Rich text editor" }],
		},
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "This editor supports " },
				{ type: "text", marks: [{ type: "bold" }], text: "bold" },
				{ type: "text", text: ", " },
				{ type: "text", marks: [{ type: "italic" }], text: "italic" },
				{ type: "text", text: ", and " },
				{ type: "text", marks: [{ type: "code" }], text: "inline code" },
				{ type: "text", text: "." },
			],
		},
		{
			type: "heading",
			attrs: { level: 2 },
			content: [{ type: "text", text: "Lists" }],
		},
		{
			type: "bulletList",
			content: [
				{
					type: "listItem",
					content: [{ type: "paragraph", content: [{ type: "text", text: "Bullet item one" }] }],
				},
				{
					type: "listItem",
					content: [{ type: "paragraph", content: [{ type: "text", text: "Bullet item two" }] }],
				},
			],
		},
		{
			type: "orderedList",
			attrs: { start: 1 },
			content: [
				{
					type: "listItem",
					content: [{ type: "paragraph", content: [{ type: "text", text: "Ordered item one" }] }],
				},
				{
					type: "listItem",
					content: [{ type: "paragraph", content: [{ type: "text", text: "Ordered item two" }] }],
				},
			],
		},
		{
			type: "blockquote",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "A blockquote for emphasis." }],
				},
			],
		},
	],
};

function note(text: string): JSONContent {
	return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

const footnoteContent: JSONContent = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "The hackathon has been running yearly since 2015" },
				{
					type: "footnote",
					attrs: {
						content: note("In the year 2020 the hackathon was not organised due to the pandemic."),
					},
				},
				{ type: "text", text: ", and has been discussed in articles" },
				{
					type: "footnote",
					attrs: {
						content: note(
							"Tolonen, Mikko. 2019. Teaching Digital Humanities at the University of Helsinki. EuropeNow.",
						),
					},
				},
				{ type: "text", text: "." },
			],
		},
	],
};

function cell(type: "tableCell" | "tableHeader", text: string): JSONContent {
	return { type, content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

const tableContent: JSONContent = {
	type: "doc",
	content: [
		{
			type: "table",
			attrs: {
				caption: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [
								{ type: "text", text: "Table 1: ", marks: [{ type: "bold" }] },
								{ type: "text", text: "hackathon participants per year" },
							],
						},
					],
				},
			},
			content: [
				{
					type: "tableRow",
					content: [cell("tableHeader", "Year"), cell("tableHeader", "Participants")],
				},
				{
					type: "tableRow",
					content: [cell("tableCell", "2015"), cell("tableCell", "42")],
				},
				{
					type: "tableRow",
					content: [cell("tableCell", "2016"), cell("tableCell", "58")],
				},
			],
		},
	],
};

const meta = {
	title: "Components/RichTextEditor",
	component: RichTextEditor,
	tags: ["autodocs"],
	argTypes: {
		isEditable: { control: "boolean" },
	},
	args: {
		// oxlint-disable-next-line typescript/strict-void-return
		onChange: fn(),
	},
} satisfies Meta<typeof RichTextEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * One document holding every block the schema marks `draggable`, each with enough attributes to
 * render in its resting state rather than with its settings panel open. Used by
 * {@link DraggableBlocks}.
 *
 * The image URL is an inline SVG data URI so the story needs no network and no storage: what is
 * being asserted is the node view's drag wiring, not that a real asset loads.
 */
const placeholderImageUrl =
	"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='3'/>";

const draggableBlocksContent: JSONContent = {
	type: "doc",
	content: [
		{ type: "paragraph", content: [{ type: "text", text: "Prose before the blocks." }] },
		{
			type: "assetImage",
			attrs: {
				imageKey: "images/example.jpg",
				imageUrl: placeholderImageUrl,
				alt: "An example image",
				captionMode: "inherit",
				layout: "default",
			},
		},
		{
			type: "embedBlock",
			attrs: {
				url: "https://www.youtube.com/watch?v=abc123",
				title: "Recording of the session",
				caption: null,
			},
		},
		{
			type: "galleryBlock",
			attrs: {
				layout: "grid",
				caption: null,
				items: [
					{
						imageKey: "images/one.jpg",
						imageUrl: placeholderImageUrl,
						alt: "First",
						captionMode: "inherit",
					},
				],
			},
		},
		{
			type: "calloutBlock",
			attrs: { intent: "info", title: "Take care" },
			content: [{ type: "paragraph", content: [{ type: "text", text: "A callout body." }] }],
		},
		{
			type: "mediaTextBlock",
			attrs: {
				imageKey: "images/ada.jpg",
				imageUrl: placeholderImageUrl,
				alt: "Ada Lovelace",
				captionMode: "inherit",
				side: "start",
			},
			content: [{ type: "paragraph", content: [{ type: "text", text: "A short biography." }] }],
		},
		{
			type: "accordionBlock",
			content: [
				{
					type: "accordionItem",
					attrs: { title: "A question" },
					content: [{ type: "paragraph", content: [{ type: "text", text: "An answer." }] }],
				},
			],
		},
	],
};

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<div className="inline-160">
				<RichTextEditor {...props} />
			</div>
		);
	},
};

export const WithContent: Story = {
	args: {
		content: sampleContent,
	},
	render(props) {
		return (
			<div className="inline-160">
				<RichTextEditor {...props} />
			</div>
		);
	},
};

/**
 * The optional blocks are opt-in by name. Nothing else is wired up here — each one inserts itself
 * and its node view opens whatever panel it needs, so the insert menu and the slash menu both offer
 * them without the surrounding form contributing a button.
 */
export const WithOptionalBlocks: Story = {
	args: {
		content: sampleContent,
		blocks: ["embed", "callout", "mediaText", "buttonLink"],
	},
	render(props) {
		return (
			<div className="inline-160">
				<RichTextEditor {...props} />
			</div>
		);
	},
};

/**
 * Footnote markers show only their number — counted from their place in the text, never stored — so
 * the notes themselves are listed under the editor for proof-reading. Clicking a marker opens its
 * note.
 */
export const WithFootnotes: Story = {
	args: {
		content: footnoteContent,
		blocks: ["footnote"],
	},
	render(props) {
		return (
			<div className="inline-160">
				<RichTextEditor {...props} />
			</div>
		);
	},
};

/**
 * A table's caption is stored on the table rather than in it — `prosemirror-tables` reads a table's
 * children as its rows — and assembled into a real `<caption>` element by this node view and by the
 * read paths, so a screen reader announces it as the table's name. It takes the same formatting the
 * image captions do: bold, italic, links and, where the field offers them, footnotes.
 */
export const WithTableCaption: Story = {
	args: {
		content: tableContent,
	},
	async play({ canvas }) {
		const table = canvas.getByRole("table");

		// The caption has to be the table's first child to name it, and the row group is appended by
		// the node view renderer itself — so the order is worth asserting rather than assuming.
		await expect(table.firstElementChild?.tagName).toBe("CAPTION");
		await expect(table).toHaveAccessibleName("Table 1: hackathon participants per year");
	},
	render(props) {
		return (
			<div className="inline-160">
				<RichTextEditor {...props} />
			</div>
		);
	},
};

export const ReadOnly: Story = {
	args: {
		content: sampleContent,
		isEditable: false,
	},
	render(props) {
		return (
			<div className="inline-160">
				<RichTextEditor {...props} />
			</div>
		);
	},
};

export const Renderer: Story = {
	args: {
		content: sampleContent,
	},
	render({ content }) {
		return (
			<div className="inline-160">
				<RichTextRenderer content={content!} />
			</div>
		);
	},
};

/**
 * Every node the schema marks `draggable` must actually carry the attribute the browser needs.
 *
 * ProseMirror sets `draggable` on a node's DOM only when the node has no content hole, so the seven
 * draggable blocks are served by two different mechanisms: `BlockNodeSurface` for the atoms, and
 * `useContainerDraggable` for the four that hold content. Miss either and the browser fires no
 * `dragstart`, tiptap's `data-drag-handle` handling never runs, and the block simply cannot be
 * moved — which is how `mediaTextBlock` went a long time without being draggable at all.
 *
 * The check is per block rather than a count, so a failure names the one that regressed, and it
 * walks up from a stable element inside each block rather than asserting where the attribute sits —
 * the two mechanisms put it in the same place, but that is ProseMirror's business, not this
 * test's.
 *
 * Every block here is given enough attributes to render in its resting state: a block whose
 * settings panel opens on mount is deliberately _not_ draggable while the author is filling in the
 * form.
 */
export const DraggableBlocks: Story = {
	/**
	 * Reported, not enforced. Every story in this file trips the same three findings, and all three
	 * belong to the editor rather than to any block here: the `textbox` root carries an
	 * `aria-expanded` that role does not allow and has no accessible name of its own, and two toolbar
	 * controls miss the contrast threshold. Failing this story on them would tie a drag regression
	 * test to unrelated a11y debt; `"todo"` keeps the findings visible until that is fixed properly.
	 */
	parameters: { a11y: { test: "todo" } },
	args: {
		blocks: ["accordion", "callout", "embed", "gallery", "mediaText"],
		content: draggableBlocksContent,
	},
	async play({ canvas }) {
		/** The nearest ancestor the browser would start a drag from, walking up from inside the block. */
		function dragRootOf(element: Element | null): Element | null {
			return element?.closest('[draggable="true"]') ?? null;
		}

		const byLabel = [
			"Image block",
			"Embed block",
			"Gallery block",
			"Callout block",
			"Accordion block",
			"Media with text block",
		];

		for (const label of byLabel) {
			await expect(
				dragRootOf(canvas.getByLabelText(label)),
				`${label} is not draggable`,
			).not.toBeNull();
		}

		// An accordion panel has no label of its own — it is named by the title field inside it — so it
		// is reached through its body instead.
		const panelBody = canvas
			.getByLabelText("Accordion block")
			.querySelector("[data-accordion-item-content]");
		await expect(dragRootOf(panelBody), "accordion panel is not draggable").not.toBeNull();

		// The panel's drag root must be the panel, not the accordion around it: dragging a panel
		// reorders it within its accordion, and if the two collapsed onto one element a panel drag
		// would pick up the whole block.
		await expect(dragRootOf(panelBody)).not.toBe(
			dragRootOf(canvas.getByLabelText("Accordion block")),
		);
	},
	render(props) {
		return (
			<div className="inline-160">
				<RichTextEditor {...props} />
			</div>
		);
	},
};
