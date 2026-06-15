import type { Meta, StoryObj } from "@storybook/react-vite";
import type { JSONContent } from "@tiptap/core";
import { fn } from "storybook/test";

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
