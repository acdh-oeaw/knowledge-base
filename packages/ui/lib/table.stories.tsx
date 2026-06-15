import type { Meta, StoryObj } from "@storybook/react-vite";

import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "./table";

const meta = {
	title: "Components/Table",
	component: Table,
	tags: ["autodocs"],
	argTypes: {
		striped: { control: "boolean" },
		grid: { control: "boolean" },
	},
	args: {},
} satisfies Meta<typeof Table>;

export default meta;

type Story = StoryObj<typeof meta>;

const columns = [
	{ id: "name", name: "Name" },
	{ id: "role", name: "Role" },
	{ id: "status", name: "Status" },
	{ id: "joined", name: "Joined" },
];

const rows = [
	{ id: 1, name: "Jane Smith", role: "Admin", status: "Active", joined: "Jan 2023" },
	{ id: 2, name: "John Doe", role: "Editor", status: "Inactive", joined: "Mar 2023" },
	{ id: 3, name: "Alice Johnson", role: "Viewer", status: "Active", joined: "Jun 2023" },
	{ id: 4, name: "Bob Williams", role: "Editor", status: "Active", joined: "Sep 2023" },
];

export const Default: Story = {
	args: {},
	render(props) {
		return (
			<Table {...props}>
				<TableHeader columns={columns}>
					{(column) => <TableColumn id={column.id}>{column.name}</TableColumn>}
				</TableHeader>
				<TableBody items={rows}>
					{(row) => (
						<TableRow id={row.id}>
							<TableCell>{row.name}</TableCell>
							<TableCell>{row.role}</TableCell>
							<TableCell>{row.status}</TableCell>
							<TableCell>{row.joined}</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		);
	},
};

export const Striped: Story = {
	args: { striped: true },
	render(props) {
		return (
			<Table {...props}>
				<TableHeader columns={columns}>
					{(column) => <TableColumn id={column.id}>{column.name}</TableColumn>}
				</TableHeader>
				<TableBody items={rows}>
					{(row) => (
						<TableRow id={row.id}>
							<TableCell>{row.name}</TableCell>
							<TableCell>{row.role}</TableCell>
							<TableCell>{row.status}</TableCell>
							<TableCell>{row.joined}</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		);
	},
};

export const WithGrid: Story = {
	args: { grid: true },
	render(props) {
		return (
			<Table {...props}>
				<TableHeader columns={columns}>
					{(column) => <TableColumn id={column.id}>{column.name}</TableColumn>}
				</TableHeader>
				<TableBody items={rows}>
					{(row) => (
						<TableRow id={row.id}>
							<TableCell>{row.name}</TableCell>
							<TableCell>{row.role}</TableCell>
							<TableCell>{row.status}</TableCell>
							<TableCell>{row.joined}</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		);
	},
};

export const Empty: Story = {
	args: {},
	render(props) {
		return (
			<Table {...props}>
				<TableHeader columns={columns}>
					{(column) => <TableColumn id={column.id}>{column.name}</TableColumn>}
				</TableHeader>
				<TableBody items={[]}>{() => <TableRow id="empty" />}</TableBody>
			</Table>
		);
	},
};
