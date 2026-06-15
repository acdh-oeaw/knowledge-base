"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { FieldError, Label, fieldErrorStyles } from "@acdh-knowledge-base/ui/field";
import { Form } from "@acdh-knowledge-base/ui/form";
import { Input } from "@acdh-knowledge-base/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@acdh-knowledge-base/ui/select";
import { Separator } from "@acdh-knowledge-base/ui/separator";
import { TextField } from "@acdh-knowledge-base/ui/text-field";
import { TextArea } from "@acdh-knowledge-base/ui/textarea";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import {
	type ContentBlock,
	ContentBlocks,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form-actions";
import { FormSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { MediaLibraryDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-dialog";
import type { ServerAction } from "@/lib/server/create-server-action";

interface DocumentOrPolicyFormProps {
	initialAssets: Array<{ key: string; label: string; url: string }>;
	contentBlocks?: Array<ContentBlock>;
	documentOrPolicy?: Pick<
		schema.DocumentOrPolicy,
		"id" | "title" | "summary" | "url" | "groupId"
	> & {
		entityVersion: { entity: { id: string; slug: string } };
	} & { document: { key: string; label: string; url: string } };
	groups: Array<Pick<schema.DocumentPolicyGroup, "id" | "label">>;
	formAction: ServerAction;
}

export function DocumentOrPolicyForm(props: Readonly<DocumentOrPolicyFormProps>): ReactNode {
	const { initialAssets, contentBlocks, formAction, documentOrPolicy, groups } = props;

	const t = useExtracted();

	const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

	const [selectedDocument, setSelectedDocument] = useState<{ key: string; label: string } | null>(
		documentOrPolicy?.document
			? { key: documentOrPolicy.document.key, label: documentOrPolicy.document.label }
			: null,
	);

	const [selectedGroupId, setSelectedGroupId] = useState<string>(documentOrPolicy?.groupId ?? "");

	const [documentKeyError, setDocumentKeyError] = useState(false);

	return (
		<Form action={action} className="flex flex-col gap-y-6" state={state}>
			<FormSection description={t("Enter the document or policy details.")} title={t("Details")}>
				<TextField defaultValue={documentOrPolicy?.title} isRequired={true} name="title">
					<Label>{t("Title")}</Label>
					<Input />
					<FieldError />
				</TextField>

				<TextField
					defaultValue={documentOrPolicy?.summary ?? undefined}
					isRequired={true}
					name="summary"
				>
					<Label>{t("Summary")}</Label>
					<TextArea rows={5} />
					<FieldError />
				</TextField>

				<TextField defaultValue={documentOrPolicy?.url ?? undefined} name="url">
					<Label>{t("URL")}</Label>
					<Input placeholder="https://" />
					<FieldError />
				</TextField>

				<Select
					onChange={(key) => {
						setSelectedGroupId(String(key === "none" ? "" : key));
					}}
					value={selectedGroupId || "none"}
				>
					<Label>{t("Group")}</Label>
					<SelectTrigger />
					<FieldError />
					<SelectContent>
						<SelectItem id="none">{t("None")}</SelectItem>
						{groups.map((group) => (
							<SelectItem key={group.id} id={group.id}>
								{group.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{selectedGroupId ? <input name="groupId" type="hidden" value={selectedGroupId} /> : null}
			</FormSection>

			<Separator className="my-6" />

			<FormSection description={t("Select or upload a document.")} title={t("Document")}>
				{selectedDocument != null && (
					<p className="text-sm text-muted-fg">{selectedDocument.label}</p>
				)}
				<MediaLibraryDialog
					defaultPrefix="documents"
					initialAssets={initialAssets}
					onSelect={(key, _url) => {
						const asset = initialAssets.find((a) => a.key === key);
						setSelectedDocument({ key, label: asset?.label ?? key });
					}}
					prefixes={["documents"]}
				/>

				<input
					aria-hidden={true}
					className="sr-only"
					name="documentKey"
					onInvalid={(e) => {
						e.preventDefault();
						setDocumentKeyError(true);
					}}
					readOnly={true}
					required={true}
					tabIndex={-1}
					value={selectedDocument?.key ?? ""}
				/>
				{documentKeyError ? (
					<div className={fieldErrorStyles()}>{t("Please select a document.")}</div>
				) : null}
			</FormSection>

			<Separator className="my-6" />

			<FormSection description={t("Add the content.")} title={t("Content")} variant="stacked">
				<ContentBlocks initialAssets={initialAssets} items={contentBlocks ?? []} />
			</FormSection>

			{documentOrPolicy != null ? (
				<Fragment>
					<input name="id" type="hidden" value={documentOrPolicy.id} />
					<input name="documentId" type="hidden" value={documentOrPolicy.entityVersion.entity.id} />
				</Fragment>
			) : null}

			<EntityFormActions
				entityName={t("Document or policy")}
				isDisabled={selectedDocument == null}
				isPending={isPending}
				state={state}
			/>
		</Form>
	);
}
