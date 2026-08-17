"use client";

import { keyBy } from "@acdh-oeaw/lib";
import type * as schema from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { GridList, GridListItem } from "@dariah-eric/ui/grid-list";
import { Input } from "@dariah-eric/ui/input";
import { ListBox, ListBoxItem } from "@dariah-eric/ui/list-box";
import { SearchField, SearchInput } from "@dariah-eric/ui/search-field";
import { Separator } from "@dariah-eric/ui/separator";
import { TextField } from "@dariah-eric/ui/text-field";
import { TextArea } from "@dariah-eric/ui/textarea";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { type ReactNode, useActionState, useMemo, useState } from "react";
import { useDragAndDrop, useListData } from "react-aria-components";

import {
	FormLayout,
	FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { MediaLibraryDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-dialog";
import { updateSiteMetadataAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/metadata/_lib/update-site-metadata.action";
import type { NewsItemOption } from "@/lib/data/news";

const MAX_ALLOWED_FEATURED_ITEMS = 3;

interface SiteMetadataFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	initialFeaturedItemsOptions: { items: Array<NewsItemOption>; total: number };
	siteMetadata:
		| (Pick<
				schema.SiteMetadata,
				"title" | "description" | "featuredItemIds" | "ogTitle" | "ogDescription"
		  > & {
				ogImage: { key: string; label: string; url: string } | null;
		  })
		| null;
}

export function SiteMetadataForm(props: Readonly<SiteMetadataFormProps>): ReactNode {
	const { initialAssets, initialFeaturedItemsOptions, siteMetadata } = props;

	const optionsById = keyBy(initialFeaturedItemsOptions.items, (item) => item.id);

	const t = useExtracted();

	const [state, action, isPending] = useActionState(
		updateSiteMetadataAction,
		createActionStateInitial(),
	);

	const [selectedImage, setSelectedImage] = useState<{ key: string; url: string } | null>(
		siteMetadata?.ogImage ?? null,
	);

	const selectedItemsList = useListData<NewsItemOption>({
		initialItems: ((siteMetadata?.featuredItemIds as Array<string> | null | undefined) ?? [])
			.map((fI) => optionsById[fI])
			.filter((item): item is NewsItemOption => item !== undefined),
		getKey(item) {
			return item.id;
		},
	});

	const [query, setQuery] = useState("");
	const [entries, setEntries] = useState<Array<NewsItemOption>>();

	async function fetchEntries(q: string) {
		const params = new URLSearchParams({ limit: "20" });
		if (q.trim() !== "") {
			params.set("q", q.trim());
		}
		const res = await fetch(`/api/news/options?${params.toString()}`);
		const data = (await res.json()) as { items: Array<NewsItemOption> };
		setEntries(data.items);
	}

	const { dragAndDropHooks } = useDragAndDrop({
		getItems: (keys, items: typeof selectedItemsList.items) =>
			items.map((item) => {
				return { "text/plain": item.name };
			}),
		onReorder(e) {
			if (e.target.dropPosition === "before") {
				selectedItemsList.moveBefore(e.target.key, e.keys);
			} else if (e.target.dropPosition === "after") {
				selectedItemsList.moveAfter(e.target.key, e.keys);
			}
		},
	});

	const disabledKeys = useMemo(() => {
		if (selectedItemsList.items.length >= MAX_ALLOWED_FEATURED_ITEMS) {
			return entries?.map((r) => r.id);
		}
		return selectedItemsList.items.map((s) => s.id);
	}, [selectedItemsList, entries]);

	return (
		<FormLayout>
			<Form action={action} className="flex flex-col gap-y-6" state={state}>
				<FormSection
					description={t("Default title and description for the website.")}
					title={t("Details")}
				>
					<TextField defaultValue={siteMetadata?.title ?? undefined} isRequired={true} name="title">
						<Label>{t("Title")}</Label>
						<Input />
						<FieldError />
					</TextField>

					<TextField
						defaultValue={siteMetadata?.description ?? undefined}
						isRequired={true}
						name="description"
					>
						<Label>{t("Description")}</Label>
						<TextArea rows={5} />
						<FieldError />
					</TextField>
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t(
						"Override title and description for social media previews. Leave blank to use the values above.",
					)}
					title={t("Open Graph")}
				>
					<TextField defaultValue={siteMetadata?.ogTitle ?? undefined} name="ogTitle">
						<Label>{t("OG title")}</Label>
						<Input placeholder={siteMetadata?.title ?? t("Defaults to title")} />
						<FieldError />
					</TextField>

					<TextField defaultValue={siteMetadata?.ogDescription ?? undefined} name="ogDescription">
						<Label>{t("OG description")}</Label>
						<TextArea
							placeholder={siteMetadata?.description ?? t("Defaults to description")}
							rows={3}
						/>
						<FieldError />
					</TextField>
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t("Image used when the website is shared on social media.")}
					title={t("Open Graph image")}
				>
					{selectedImage != null && (
						<img
							alt={t("Selected OG image")}
							className="block-24 inline-auto max-inline-full rounded-lg object-contain"
							src={selectedImage.url}
						/>
					)}
					<MediaLibraryDialog
						defaultPrefix="images"
						initialAssets={initialAssets}
						onSelect={(key, url) => {
							setSelectedImage({ key, url });
						}}
						prefixes={["avatars", "images", "logos"]}
					/>
					{selectedImage != null ? (
						<Button
							intent="outline"
							onPress={() => {
								setSelectedImage(null);
							}}
						>
							{t("Remove image")}
						</Button>
					) : null}
					<input
						aria-hidden={true}
						className="sr-only"
						name="imageKey"
						readOnly={true}
						tabIndex={-1}
						value={selectedImage?.key ?? ""}
					/>
				</FormSection>

				<Separator className="my-6" />

				<FormSection
					description={t("Featured News Items on the landing page.")}
					title={t("Featured News Items")}
				>
					<div className="flex flex-col gap-y-3">
						<div className="flex flex-col gap-y-3">
							<SearchField
								aria-label={t("Search entries")}
								onChange={(q) => {
									setQuery(q);
									void fetchEntries(q);
								}}
								value={query}
							>
								<SearchInput />
							</SearchField>
							<div className="flex max-block-64 flex-col gap-y-2 overflow-y-auto p-2">
								<div className="relative">
									{query && entries !== undefined && entries.length > 0 && (
										<ListBox
											selectedKeys={selectedItemsList.items.map((s) => s.id)}
											aria-label={"News Items"}
											disabledKeys={disabledKeys}
											items={entries}
											selectionMode="none"
											onAction={(key) => {
												const entry = entries.find((item) => item.id === key);
												if (entry) {
													selectedItemsList.append(entry);
												}
											}}
										>
											{(item) => (
												<ListBoxItem id={item.id} textValue={item.name}>
													{item.name}
												</ListBoxItem>
											)}
										</ListBox>
									)}
								</div>
							</div>
						</div>
						{selectedItemsList.items.length === 0 ? (
							<p className="text-muted-fg p-2 text-xs">{t("No featured items yet.")}</p>
						) : (
							<GridList
								items={selectedItemsList.items}
								aria-label={"Featured Items"}
								dragAndDropHooks={dragAndDropHooks}
							>
								{(item) => (
									<GridListItem id={item.id} textValue={item.name}>
										<span>{item.name}</span>
										<Button
											className="ms-auto"
											intent="plain"
											onPress={() => {
												selectedItemsList.remove(item.id);
											}}
										>
											<TrashIcon className="me-2 block-4 inline-4" />
										</Button>
									</GridListItem>
								)}
							</GridList>
						)}
						{selectedItemsList.items.map((item, idx) => (
							<input
								key={`item-${String(idx)}`}
								name={`featuredItemIds.${String(idx)}`}
								type="hidden"
								value={item.id}
							/>
						))}
					</div>
				</FormSection>

				<div className="flex items-center justify-end gap-x-3">
					<FormStatus className="text-sm" state={state} />

					<Button isPending={isPending} type="submit">
						{isPending ? <span aria-hidden={true}>{t("Saving...")}</span> : t("Save")}
					</Button>
				</div>
			</Form>
		</FormLayout>
	);
}
