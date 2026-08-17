"use client";

import {
	CommandMenu,
	CommandMenuDescription,
	CommandMenuItem,
	CommandMenuLabel,
	CommandMenuList,
	CommandMenuSearch,
	CommandMenuSection,
} from "@dariah-eric/ui/command-menu";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";

import { useSidebarMenu } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/dashboard-sidebar";
import { useRouter } from "@/lib/navigation/navigation";

interface CommandPaletteProps {
	isAdmin: boolean;
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
}

interface DashboardSearchResult {
	id: string;
	type: "person" | "project" | "organisational-unit" | "website-content" | "report";
	label: string;
	description: string;
	href: string;
}

export function CommandPalette(props: Readonly<CommandPaletteProps>): ReactNode {
	const { isAdmin, isOpen, setIsOpen } = props;

	const t = useExtracted();
	const sidebarMenu = useSidebarMenu(isAdmin);

	const [searchInput, setSearchInput] = useState("");
	const [searchResults, setSearchResults] = useState<Array<DashboardSearchResult>>([]);
	const [searchError, setSearchError] = useState<"rate-limit" | null>(null);
	const [isSearching, setIsSearching] = useState(false);

	const router = useRouter();
	const query = searchInput.trim();

	useEffect(() => {
		if (!isOpen || query.length < 2) {
			setSearchResults([]);
			setSearchError(null);
			setIsSearching(false);
			return;
		}

		const controller = new AbortController();
		setSearchResults([]);
		setSearchError(null);
		const timeoutId = window.setTimeout(() => {
			setIsSearching(true);

			async function searchDashboardEntities() {
				try {
					const params = new URLSearchParams({ q: query, limit: "8" });
					const response = await fetch(`/api/search/dashboard?${params.toString()}`, {
						signal: controller.signal,
					});

					if (!response.ok) {
						if (response.status === 429) {
							setSearchError("rate-limit");
							setSearchResults([]);
							return;
						}

						throw new Error("Failed to search dashboard entities.");
					}

					const result = (await response.json()) as { items?: Array<DashboardSearchResult> };
					setSearchError(null);
					setSearchResults(result.items ?? []);
				} catch (error: unknown) {
					if (error instanceof DOMException && error.name === "AbortError") {
						return;
					}

					setSearchError(null);
					setSearchResults([]);
				} finally {
					if (!controller.signal.aborted) {
						setIsSearching(false);
					}
				}
			}

			void searchDashboardEntities();
		}, 250);

		return () => {
			window.clearTimeout(timeoutId);
			controller.abort();
		};
	}, [isOpen, query]);

	function navigate(url: string) {
		router.push(url, { scroll: false });

		setIsOpen(false);
	}

	return (
		<CommandMenu
			inputValue={searchInput}
			isOpen={isOpen}
			isPending={isSearching}
			onInputChange={setSearchInput}
			onOpenChange={setIsOpen}
			shortcut="k"
		>
			<CommandMenuSearch placeholder={t("Quick search...")} />
			<CommandMenuList>
				{searchResults.length > 0 ? (
					<CommandMenuSection label={t("Entities")}>
						{searchResults.map((item) => (
							<CommandMenuItem
								key={`${item.type}:${item.id}`}
								onAction={() => {
									navigate(item.href);
								}}
								textValue={`${item.label} ${item.description}`}
							>
								<CommandMenuLabel>{item.label}</CommandMenuLabel>
								<CommandMenuDescription>{item.description}</CommandMenuDescription>
							</CommandMenuItem>
						))}
					</CommandMenuSection>
				) : null}
				{searchError === "rate-limit" ? (
					<div className="col-span-full px-2.5 py-2 text-muted-fg text-sm">
						{t("Too many requests. Please wait a moment and try again.")}
					</div>
				) : null}
				{sidebarMenu.map((section, index) => (
					// eslint-disable-next-line @eslint-react/no-array-index-key
					<CommandMenuSection key={index} label={section.title}>
						{section.items.map((item, index) => (
							<CommandMenuItem
								// eslint-disable-next-line @eslint-react/no-array-index-key
								key={index}
								onAction={() => {
									navigate(item.href);
								}}
								textValue={item.tooltip}
							>
								{item.icon}
								<CommandMenuLabel>{item.label}</CommandMenuLabel>
							</CommandMenuItem>
						))}
					</CommandMenuSection>
				))}
			</CommandMenuList>
		</CommandMenu>
	);
}
