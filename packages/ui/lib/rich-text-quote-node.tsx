"use client";

import { type JSONContent, Node, mergeAttributes } from "@tiptap/core";
import {
	NodeViewContent,
	type NodeViewProps,
	NodeViewWrapper,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	ImageOffIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
	UserIcon,
} from "lucide-react";
import { type ReactNode, createContext, use, useId, useState } from "react";
import { twMerge } from "tailwind-merge";

import { Button } from "@/lib/button";
import { InlineRichTextEditor } from "@/lib/inline-rich-text-editor";
import { InlineRichTextRenderer } from "@/lib/inline-rich-text-renderer";
import { Input } from "@/lib/input";
import { isEmptyRichTextDocument, toPlainText } from "@/lib/rich-text";
import {
	type QuoteAuthor,
	normalizeQuoteAuthors,
	parseCaptionAttr,
	parseQuoteAuthorsAttr,
	serializeCaptionAttr,
	serializeQuoteAuthorsAttr,
} from "@/lib/rich-text-block-attrs";
import { blockPanelFooterClassName, useContainerDraggable } from "@/lib/rich-text-node-chrome";

export { type QuoteAuthor, normalizeQuoteAuthors };

/**
 * What a host's person picker is handed: whether it is open, and where to report the person chosen
 * — their document id, and their name as it reads now.
 */
export interface QuotePersonPickerRenderArgs {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	select: (entityId: string, name: string) => void;
}

export type QuotePersonPickerRenderer = (args: QuotePersonPickerRenderArgs) => ReactNode;

/** The editor's trigger-shaped image picker (`renderImagePicker`), reporting the asset chosen. */
export type QuoteImagePickerRenderer = (
	insert: (imageKey: string, imageUrl: string) => void,
) => ReactNode;

export interface QuoteHost {
	/** Credits a person in the knowledge base. Without one, authors are typed-in names only. */
	renderPersonPicker?: QuotePersonPickerRenderer | null;
	/** Gives a typed-in author a picture. Without one, only persons have portraits. */
	renderImagePicker?: QuoteImagePickerRenderer | null;
}

/**
 * The host's pickers, for a quote's settings panel to open.
 *
 * Context rather than node factory arguments: a factory argument is part of the schema's identity,
 * so a host passing an inline render function would rebuild the schema — and push `setOptions`
 * through the live editor — on every render. Node views render through portals inside
 * `EditorContent`, so a provider around it reaches them.
 */
export const QuoteHostContext = createContext<QuoteHost>({});

/** An author's picture, where one can be shown: typed-in authors carry theirs as a signed url. */
function QuoteAuthorAvatar({ author }: Readonly<{ author: QuoteAuthor }>): ReactNode {
	if (author.kind !== "text" || author.imageUrl == null) {
		return null;
	}

	// Decorative: the name it belongs to is always written out beside it.
	return (
		<img
			alt=""
			className="shrink-0 rounded-full object-cover block-6 inline-6"
			src={author.imageUrl}
		/>
	);
}

/**
 * The authors without their display-only image urls — what is written out, as opposed to what the
 * editor shows. A url is signed for the session that loaded the document, and is re-signed on the
 * next load from the key kept beside it.
 */
export function withoutQuoteAuthorImageUrls(authors: Array<QuoteAuthor>): Array<QuoteAuthor> {
	return authors.map((author) => {
		if (author.kind !== "text" || author.imageUrl == null) {
			return author;
		}
		const { imageUrl: _imageUrl, ...rest } = author;
		return rest;
	});
}

/** `"A"`, `"A and B"`, `"A, B, and C"` — the byline's authors as one phrase. */
export function formatQuoteAuthorNames(authors: ReadonlyArray<QuoteAuthor>): string {
	const names = authors.map((author) => author.name).filter((name) => name !== "");

	return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(names);
}

/** The whole byline as plain text, for the static HTML fallback. */
function formatQuoteByline(authors: ReadonlyArray<QuoteAuthor>, description: JSONContent | null) {
	return [formatQuoteAuthorNames(authors), toPlainText(description)]
		.filter((part) => part !== "")
		.join(", ");
}

interface QuoteSettingsValues {
	authors: Array<QuoteAuthor>;
	description: JSONContent | null;
}

/**
 * The byline as the author edits it. Committed on Apply rather than per keystroke, like a callout's
 * settings: writing straight to `updateAttributes` would dispatch a transaction into the outer
 * editor on every character.
 */
function QuoteSettings({
	authors,
	description,
	onApply,
	onCancel,
}: Readonly<
	QuoteSettingsValues & {
		onApply: (values: QuoteSettingsValues) => void;
		onCancel: () => void;
	}
>): ReactNode {
	const { renderPersonPicker, renderImagePicker } = use(QuoteHostContext);

	const [authorsInput, setAuthorsInput] = useState<Array<QuoteAuthor>>(authors);
	const [nameInput, setNameInput] = useState("");
	const [descriptionInput, setDescriptionInput] = useState<JSONContent | null>(description);
	const [isPersonPickerOpen, setIsPersonPickerOpen] = useState(false);
	const nameInputId = useId();
	const authorsLabelId = useId();

	function addAuthor(author: QuoteAuthor) {
		setAuthorsInput((current) => {
			// The same author twice is a slip, not a byline — and the list is keyed by who they are.
			const isDuplicate = current.some((item) =>
				item.kind === "person"
					? author.kind === "person" && item.entityId === author.entityId
					: author.kind === "text" && item.name === author.name,
			);
			if (isDuplicate) {
				return current;
			}
			return [...current, author];
		});
	}

	function addNamedAuthor() {
		const name = nameInput.trim();
		if (name === "") {
			return;
		}
		addAuthor({ kind: "text", name });
		setNameInput("");
	}

	function moveAuthor(index: number, offset: -1 | 1) {
		setAuthorsInput((current) => {
			const target = index + offset;
			if (target < 0 || target >= current.length) {
				return current;
			}
			const next = [...current];
			[next[index], next[target]] = [next[target]!, next[index]!];
			return next;
		});
	}

	function setAuthorImage(index: number, image: { imageKey: string; imageUrl: string } | null) {
		setAuthorsInput((current) =>
			current.map((author, i) => {
				if (i !== index || author.kind !== "text") {
					return author;
				}
				const { imageKey: _imageKey, imageUrl: _imageUrl, ...rest } = author;
				return image != null ? { ...rest, ...image } : rest;
			}),
		);
	}

	function removeAuthor(index: number) {
		setAuthorsInput((current) => current.filter((_, i) => i !== index));
	}

	return (
		<div
			className="flex flex-col gap-y-3 border border-input bg-bg p-4 select-none **:[[contenteditable]]:select-text [&_input]:select-text"
			contentEditable={false}
		>
			<div className="flex flex-col gap-y-1">
				<span className="text-sm/6 font-medium" id={authorsLabelId}>
					{"Authors"}
				</span>
				{authorsInput.length > 0 ? (
					<ul aria-labelledby={authorsLabelId} className="flex flex-col gap-y-1">
						{authorsInput.map((author, index) => {
							// A person picked while nameless still needs something to read out.
							const label = author.name !== "" ? author.name : "Unnamed person";

							return (
								<li
									key={
										author.kind === "person" ? `person:${author.entityId}` : `text:${author.name}`
									}
									className="flex items-center gap-x-2 rounded-md border border-border px-2 py-1 text-sm"
								>
									{author.kind === "person" ? (
										<UserIcon
											aria-label="Person in the knowledge base"
											className="shrink-0 text-muted-fg block-3.5 inline-3.5"
										/>
									) : (
										<QuoteAuthorAvatar author={author} />
									)}
									<span className="flex-1 truncate">{label}</span>
									{/* A person's portrait comes from their entry; anybody else can be given one here. */}
									{author.kind === "text" && renderImagePicker != null ? (
										<span className="contents" title={`Choose a picture of ${label}`}>
											{renderImagePicker((imageKey, imageUrl) => {
												setAuthorImage(index, { imageKey, imageUrl });
											})}
										</span>
									) : null}
									{author.kind === "text" && author.imageKey != null ? (
										<button
											aria-label={`Remove the picture of ${label}`}
											className="rounded-sm p-1 text-muted-fg hover:text-danger"
											onClick={() => {
												setAuthorImage(index, null);
											}}
											type="button"
										>
											<ImageOffIcon className="block-3.5 inline-3.5" />
										</button>
									) : null}
									<button
										aria-label={`Move ${label} up`}
										className="rounded-sm p-1 text-muted-fg hover:text-fg disabled:opacity-40"
										disabled={index === 0}
										onClick={() => {
											moveAuthor(index, -1);
										}}
										type="button"
									>
										<ArrowUpIcon className="block-3.5 inline-3.5" />
									</button>
									<button
										aria-label={`Move ${label} down`}
										className="rounded-sm p-1 text-muted-fg hover:text-fg disabled:opacity-40"
										disabled={index === authorsInput.length - 1}
										onClick={() => {
											moveAuthor(index, 1);
										}}
										type="button"
									>
										<ArrowDownIcon className="block-3.5 inline-3.5" />
									</button>
									<button
										aria-label={`Remove ${label}`}
										className="rounded-sm p-1 text-muted-fg hover:text-danger"
										onClick={() => {
											removeAuthor(index);
										}}
										type="button"
									>
										<Trash2Icon className="block-3.5 inline-3.5" />
									</button>
								</li>
							);
						})}
					</ul>
				) : (
					<p className="text-sm text-muted-fg">{"No authors yet."}</p>
				)}
				<div className="mbs-1 flex items-end gap-x-2">
					<div className="flex flex-1 flex-col gap-y-1">
						<label className="text-xs text-muted-fg" htmlFor={nameInputId}>
							{"Add a name"}
						</label>
						<Input
							id={nameInputId}
							onChange={(event) => {
								setNameInput(event.target.value);
							}}
							onKeyDown={(event) => {
								// Enter would otherwise reach the outer editor's form and submit it.
								if (event.key === "Enter") {
									event.preventDefault();
									addNamedAuthor();
								}
							}}
							value={nameInput}
						/>
					</div>
					<Button
						intent="outline"
						isDisabled={nameInput.trim() === ""}
						onPress={addNamedAuthor}
						size="sm"
						type="button"
					>
						<PlusIcon className="block-4 inline-4" />
						{"Add"}
					</Button>
					{renderPersonPicker != null ? (
						<Button
							intent="outline"
							onPress={() => {
								setIsPersonPickerOpen(true);
							}}
							size="sm"
							type="button"
						>
							<UserIcon className="block-4 inline-4" />
							{"Add person"}
						</Button>
					) : null}
				</div>
			</div>
			<div className="flex flex-col gap-y-1">
				<span className="text-sm/6 font-medium">{"Description (optional)"}</span>
				<InlineRichTextEditor
					aria-label="Byline description"
					content={description ?? undefined}
					onChange={setDescriptionInput}
				/>
				<p className="text-xs text-muted-fg">
					{"Who the authors are, e.g. their role and institution. Links are allowed."}
				</p>
			</div>
			<div className={blockPanelFooterClassName}>
				<Button
					intent="primary"
					onPress={() => {
						onApply({
							authors: authorsInput,
							description: isEmptyRichTextDocument(descriptionInput) ? null : descriptionInput,
						});
					}}
					size="sm"
					type="button"
				>
					{"Apply"}
				</Button>
				<Button intent="outline" onPress={onCancel} size="sm" type="button">
					{"Cancel"}
				</Button>
			</div>
			{renderPersonPicker?.({
				isOpen: isPersonPickerOpen,
				onOpenChange: setIsPersonPickerOpen,
				select(entityId, name) {
					addAuthor({ kind: "person", entityId, name });
				},
			})}
		</div>
	);
}

/**
 * A quote as the author edits it: the quoted text is ordinary prose in a content hole, and the
 * byline beneath it is chrome built from the node's attributes.
 */
function QuoteNodeView({
	editor,
	node,
	selected,
	updateAttributes,
	deleteNode,
}: Readonly<NodeViewProps>): ReactNode {
	const authors = normalizeQuoteAuthors(node.attrs.authors);
	const description = node.attrs.description as JSONContent | null;
	const [isEditing, setIsEditing] = useState(false);
	const wrapperRef = useContainerDraggable(editor.isEditable && !isEditing);

	const authorNames = formatQuoteAuthorNames(authors);
	const hasDescription = !isEmptyRichTextDocument(description);
	const hasByline = authorNames !== "" || hasDescription;

	return (
		<NodeViewWrapper ref={wrapperRef} aria-label="Quote block" role="group">
			{isEditing ? (
				<QuoteSettings
					authors={authors}
					description={description}
					onApply={(values) => {
						updateAttributes(values);
						setIsEditing(false);
					}}
					onCancel={() => {
						setIsEditing(false);
					}}
				/>
			) : null}
			<figure
				className={twMerge(
					"group relative my-4 rounded-lg transition-shadow",
					selected && "ring-2 ring-primary/20",
				)}
			>
				<blockquote className="m-0">
					<NodeViewContent data-quote-content="" />
				</blockquote>
				{hasByline ? (
					<figcaption className="mbs-2 ps-5 text-sm text-muted-fg" contentEditable={false}>
						{authors.some((author) => author.kind === "text" && author.imageUrl != null) ? (
							<span className="mbe-1 flex gap-x-1">
								{authors.map((author) => (
									<QuoteAuthorAvatar
										key={
											author.kind === "person" ? `person:${author.entityId}` : `text:${author.name}`
										}
										author={author}
									/>
								))}
							</span>
						) : null}
						{authorNames !== "" ? <span className="font-medium text-fg">{authorNames}</span> : null}
						{hasDescription ? (
							<InlineRichTextRenderer
								className={twMerge("text-muted-fg", authorNames !== "" && "mbs-0.5")}
								content={description!}
							/>
						) : null}
					</figcaption>
				) : editor.isEditable ? (
					<figcaption className="mbs-2 ps-5" contentEditable={false}>
						<button
							className="text-sm text-muted-fg underline decoration-dotted underline-offset-2 hover:text-fg"
							onClick={() => {
								setIsEditing(true);
							}}
							type="button"
						>
							{"Add attribution"}
						</button>
					</figcaption>
				) : null}
				{editor.isEditable && !isEditing ? (
					// Chrome, not content, and the drag handle — same arrangement as a callout's controls.
					<div
						className="absolute inset-e-2 inset-bs-2 flex gap-x-1 opacity-0 transition-opacity group-hover:opacity-100"
						contentEditable={false}
						data-drag-handle=""
					>
						<button
							aria-label="Edit quote attribution"
							className="rounded-sm bg-bg/90 p-1 text-muted-fg shadow-sm hover:text-fg"
							onClick={() => {
								setIsEditing(true);
							}}
							type="button"
						>
							<PencilIcon className="block-3.5 inline-3.5" />
						</button>
						<button
							aria-label="Remove quote"
							className="rounded-sm bg-bg/90 p-1 text-muted-fg shadow-sm hover:text-danger"
							onClick={deleteNode}
							type="button"
						>
							<Trash2Icon className="block-3.5 inline-3.5" />
						</button>
					</div>
				) : null}
			</figure>
		</NodeViewWrapper>
	);
}

/**
 * A quotation with its attribution (#958).
 *
 * The plain `blockquote` the starter kit brings stays for quotations nobody is credited with; this
 * one adds the byline it cannot express: any number of authors — people in the knowledge base by
 * reference, anybody else by name — and a description of who they are, which may hold links.
 *
 * `block`, not `container`: the quoted text is prose and nothing else (`paragraph+`), so the node
 * holds no image or other typed block that saving would have to split out, and it is stored inside
 * a `rich_text` block like any paragraph. That is also what lets a quote sit inside a callout or an
 * accordion panel.
 *
 * The byline lives in attributes rather than in child nodes, for the same reason a footnote's note
 * does: a person is a reference, not text to type into, and attributes keep the byline out of the
 * editable flow, where it would otherwise be splittable, mergeable and liftable like the prose.
 */
export const QuoteNode = Node.create({
	name: "quoteBlock",
	group: "block",
	content: "paragraph+",
	// `defining` keeps the quote when its text is replaced by a paste; `isolating` stops backspace at
	// the start of the text from lifting it out into the block above.
	defining: true,
	isolating: true,
	draggable: true,
	selectable: true,

	addAttributes() {
		return {
			authors: {
				default: [],
				parseHTML: (element) => parseQuoteAuthorsAttr(element.dataset.authors),
				renderHTML: (attributes) => {
					const value = serializeQuoteAuthorsAttr(
						withoutQuoteAuthorImageUrls(normalizeQuoteAuthors(attributes.authors)),
					);
					return value == null ? {} : { "data-authors": value };
				},
			},
			/** Same constrained `{ doc > paragraph }` richtext captions and footnote notes use. */
			description: {
				default: null,
				parseHTML: (element) => parseCaptionAttr(element.dataset.description),
				renderHTML: (attributes) => {
					const value = serializeCaptionAttr(attributes.description as JSONContent | null);
					return value == null ? {} : { "data-description": value };
				},
			},
		};
	},

	parseHTML() {
		return [{ tag: "figure[data-quote-block]", contentElement: "blockquote" }];
	},

	renderHTML({ node, HTMLAttributes }) {
		const byline = formatQuoteByline(
			normalizeQuoteAuthors(node.attrs.authors),
			node.attrs.description as JSONContent | null,
		);

		// The byline is written out as text too, so static HTML (a preview, a copy into another app)
		// still credits the quote. Pasting it back reads the attributes and skips the caption: the
		// parse rule takes its content from the `blockquote` alone.
		const figureAttributes = mergeAttributes({ "data-quote-block": "" }, HTMLAttributes);

		return byline !== ""
			? ["figure", figureAttributes, ["blockquote", 0], ["figcaption", {}, byline]]
			: ["figure", figureAttributes, ["blockquote", 0]];
	},

	addNodeView() {
		return ReactNodeViewRenderer(QuoteNodeView);
	},
});
