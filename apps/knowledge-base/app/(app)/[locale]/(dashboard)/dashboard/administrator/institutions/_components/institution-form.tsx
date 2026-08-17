"use client";

import type * as schema from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
import { Description, FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { Input } from "@dariah-eric/ui/input";
import { Separator } from "@dariah-eric/ui/separator";
import { TextField } from "@dariah-eric/ui/text-field";
import { TextArea } from "@dariah-eric/ui/textarea";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form-actions";
import { EntityRelationsFields } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-relations-fields";
import {
  FormLayout,
  FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { MediaLibraryDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-dialog";
import { RichTextContentBlocksField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/rich-text-content-blocks-field";
import { SocialMediaRelationsFields } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/social-media-relations-fields";
import type { ServerAction } from "@/lib/server/create-server-action";

interface InstitutionFormProps {
  initialAssets: Array<{ key: string; label: string; url: string }>;
  /**
   * Acronym/ROR/SSHOC actor ID aren't translatable — the DB keeps them synced from the default
   * locale's version regardless, so this locks their inputs when editing another locale. Defaults
   * to `true` (the create form has no locale concept, and always starts in the default locale).
   */
  isDefaultLocale?: boolean;
  institution?: Pick<
    schema.OrganisationalUnit,
    "acronym" | "id" | "name" | "ror" | "sshocMarketplaceActorId" | "summary"
  > & {
    descriptionContentBlocks?: Array<ContentBlock>;
    entityVersion: { entity: { id: string }; slug: { value: string } };
  } & { image: { key: string; label: string; url: string } | null };
  formId?: string;
  formAction: ServerAction;
  initialRelatedEntityIds?: Array<string>;
  initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
  initialRelatedEntityTotal: number;
  initialRelatedResourceIds?: Array<string>;
  initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
  initialRelatedResourceTotal: number;
  initialSocialMediaIds?: Array<string>;
  initialSocialMediaItems?: Array<{ id: string; name: string; description?: string }>;
  initialSocialMediaTotal?: number;
  selectedRelatedEntities?: Array<{ id: string; name: string; description?: string }>;
  selectedRelatedResources?: Array<{ id: string; name: string; description?: string }>;
  selectedSocialMediaItems?: Array<{ id: string; name: string; description?: string }>;
  showRelationFields?: boolean;
}

export function InstitutionForm(props: Readonly<InstitutionFormProps>): ReactNode {
  const {
    initialAssets,
    formAction,
    formId,
    isDefaultLocale = true,
    institution,
    initialRelatedEntityIds,
    initialRelatedEntityItems,
    initialRelatedEntityTotal,
    initialRelatedResourceIds,
    initialRelatedResourceItems,
    initialRelatedResourceTotal,
    initialSocialMediaIds,
    initialSocialMediaItems,
    initialSocialMediaTotal,
    selectedRelatedEntities,
    selectedRelatedResources,
    selectedSocialMediaItems,
    showRelationFields = true,
  } = props;

  const t = useExtracted();

  const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

  const [selectedImage, setSelectedImage] = useState<{ key: string; url: string } | null>(
    institution?.image ?? null,
  );

  return (
    <FormLayout>
      <Form action={action} className="flex flex-col gap-y-6" id={formId} state={state}>
        <FormSection description={t("Enter the institution details.")} title={t("Details")}>
          <TextField defaultValue={institution?.name} isRequired={true} name="name">
            <Label>{t("Name")}</Label>
            <Input />
            <FieldError />
          </TextField>

          {isDefaultLocale ? (
            <TextField defaultValue={institution?.acronym ?? undefined} name="acronym">
              <Label>{t("Acronym")}</Label>
              <Input />
              <FieldError />
            </TextField>
          ) : (
            <div className="flex flex-col gap-y-1">
              <Label>{t("Acronym")}</Label>
              <p className="text-sm">{institution?.acronym ?? t("Not set")}</p>
              <Description>{t("Editable only in the default locale.")}</Description>
              {institution?.acronym != null ? (
                <input name="acronym" type="hidden" value={institution.acronym} />
              ) : null}
            </div>
          )}

          {isDefaultLocale ? (
            <TextField defaultValue={institution?.ror ?? undefined} name="ror">
              <Label>{t("ROR")}</Label>
              <Input />
              <FieldError />
            </TextField>
          ) : (
            <div className="flex flex-col gap-y-1">
              <Label>{t("ROR")}</Label>
              <p className="text-sm">{institution?.ror ?? t("Not set")}</p>
              <Description>{t("Editable only in the default locale.")}</Description>
              {institution?.ror != null ? (
                <input name="ror" type="hidden" value={institution.ror} />
              ) : null}
            </div>
          )}

          {isDefaultLocale ? (
            <TextField
              defaultValue={
                institution?.sshocMarketplaceActorId != null
                  ? String(institution.sshocMarketplaceActorId)
                  : undefined
              }
              name="sshocMarketplaceActorId"
              type="number"
            >
              <Label>{t("SSHOC actor ID")}</Label>
              <Input />
              <FieldError />
            </TextField>
          ) : (
            <div className="flex flex-col gap-y-1">
              <Label>{t("SSHOC actor ID")}</Label>
              <p className="text-sm">
                {institution?.sshocMarketplaceActorId != null
                  ? String(institution.sshocMarketplaceActorId)
                  : t("Not set")}
              </p>
              <Description>{t("Editable only in the default locale.")}</Description>
              {institution?.sshocMarketplaceActorId != null ? (
                <input
                  name="sshocMarketplaceActorId"
                  type="hidden"
                  value={institution.sshocMarketplaceActorId}
                />
              ) : null}
            </div>
          )}

          <TextField defaultValue={institution?.summary ?? undefined} name="summary">
            <Label>{t("Summary")}</Label>
            <TextArea rows={5} />
            <FieldError />
          </TextField>
        </FormSection>

        <Separator className="my-6" />

        <FormSection description={t("Select or upload an image.")} title={t("Image")}>
          {selectedImage != null && (
            <img
              alt={t("Selected image")}
              className="block-24 inline-auto max-inline-full rounded-lg object-contain"
              src={selectedImage.url}
            />
          )}
          <MediaLibraryDialog
            defaultPrefix="logos"
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
          description={t("Add a description.")}
          title={t("Description")}
          variant="stacked"
        >
          <RichTextContentBlocksField
            aria-label={t("Description")}
            initialBlocks={institution?.descriptionContentBlocks}
            initialAssets={initialAssets}
            name="description"
          />
        </FormSection>

        <Separator className="my-6" />

        {initialSocialMediaItems != null && initialSocialMediaTotal != null ? (
          <Fragment>
            <SocialMediaRelationsFields
              description={t("Link social media accounts to this institution.")}
              initialSocialMediaIds={initialSocialMediaIds}
              initialSocialMediaItems={initialSocialMediaItems}
              initialSocialMediaTotal={initialSocialMediaTotal}
              selectedSocialMediaItems={selectedSocialMediaItems}
            />

            <Separator className="my-6" />
          </Fragment>
        ) : null}

        {showRelationFields ? (
          <EntityRelationsFields
            formId={formId}
            initialRelatedEntityIds={initialRelatedEntityIds}
            initialRelatedEntityItems={initialRelatedEntityItems}
            initialRelatedEntityTotal={initialRelatedEntityTotal}
            initialRelatedResourceIds={initialRelatedResourceIds}
            initialRelatedResourceItems={initialRelatedResourceItems}
            initialRelatedResourceTotal={initialRelatedResourceTotal}
            selectedRelatedEntities={selectedRelatedEntities}
            selectedRelatedResources={selectedRelatedResources}
          />
        ) : null}

        {institution != null ? (
          <Fragment>
            <input name="id" type="hidden" value={institution.id} />
            <input name="documentId" type="hidden" value={institution.entityVersion.entity.id} />
          </Fragment>
        ) : null}

        <EntityFormActions entityName={t("Institution")} isPending={isPending} state={state} />
      </Form>
    </FormLayout>
  );
}
