import { DocumentIcon, FolderIcon } from "@heroicons/react/20/solid";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Collection } from "react-aria-components";

import { Tree, TreeContent, TreeItem } from "./tree";

const meta = {
	title: "Components/Tree",
	component: Tree,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {},
} satisfies Meta<typeof Tree>;

export default meta;

type Story = StoryObj<typeof meta>;

interface FileItem {
	id: string;
	name: string;
	childItems?: Array<FileItem>;
}

const files: Array<FileItem> = [
	{
		id: "documents",
		name: "Documents",
		childItems: [
			{ id: "report", name: "Report.pdf" },
			{ id: "budget", name: "Budget.xlsx" },
			{
				id: "projects",
				name: "Projects",
				childItems: [
					{ id: "project-a", name: "Project A.docx" },
					{ id: "project-b", name: "Project B.docx" },
				],
			},
		],
	},
	{
		id: "images",
		name: "Images",
		childItems: [
			{ id: "photo1", name: "photo1.jpg" },
			{ id: "photo2", name: "photo2.png" },
		],
	},
	{ id: "readme", name: "README.md" },
];

export const Default: Story = {
	args: {},
	render() {
		return (
			<div className="inline-64">
				<Tree aria-label={"File system"} items={files}>
					{/* oxlint-disable-next-line unicorn/consistent-function-scoping */}
					{function renderItem(item) {
						return (
							<TreeItem id={item.id} textValue={item.name}>
								<TreeContent>
									{item.childItems != null ? (
										<FolderIcon className="text-muted-fg" />
									) : (
										<DocumentIcon className="text-muted-fg" />
									)}
									{item.name}
								</TreeContent>
								<Collection items={item.childItems}>{renderItem}</Collection>
							</TreeItem>
						);
					}}
				</Tree>
			</div>
		);
	},
};

export const Selectable: Story = {
	args: {},
	render() {
		return (
			<div className="inline-64">
				<Tree aria-label={"File system"} items={files} selectionMode="single">
					{/* oxlint-disable-next-line unicorn/consistent-function-scoping */}
					{function renderItem(item) {
						return (
							<TreeItem id={item.id} textValue={item.name}>
								<TreeContent>
									{item.childItems != null ? (
										<FolderIcon className="text-muted-fg" />
									) : (
										<DocumentIcon className="text-muted-fg" />
									)}
									{item.name}
								</TreeContent>
								<Collection items={item.childItems}>{renderItem}</Collection>
							</TreeItem>
						);
					}}
				</Tree>
			</div>
		);
	},
};

export const MultiSelectable: Story = {
	args: {},
	render() {
		return (
			<div className="inline-64">
				<Tree aria-label={"File system"} items={files} selectionMode="multiple">
					{/* oxlint-disable-next-line unicorn/consistent-function-scoping */}
					{function renderItem(item) {
						return (
							<TreeItem id={item.id} textValue={item.name}>
								<TreeContent>
									{item.childItems != null ? (
										<FolderIcon className="text-muted-fg" />
									) : (
										<DocumentIcon className="text-muted-fg" />
									)}
									{item.name}
								</TreeContent>
								<Collection items={item.childItems}>{renderItem}</Collection>
							</TreeItem>
						);
					}}
				</Tree>
			</div>
		);
	},
};
