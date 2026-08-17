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

interface CountryFormProps {
  initialAssets: Array<{ key: string; label: string; url: string }>;
  /**
   * The acronym isn't translatable — the DB keeps it synced from the default locale's version
   * regardless, so this locks its input when editing another locale. Defaults to `true` (the create
   * form has no locale concept, and always starts in the default locale).
   */
  isDefaultLocale?: boolean;
  country?: Pick<schema.OrganisationalUnit, "acronym" | "id" | "name" | "summary"> & {
    descriptionContentBlocks?: Array<ContentBlock>;
    entityVersion: {
      entity: Pick<schema.Entity, "id">;
      slug: Pick<schema.Slug, "value">;
    };
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
  showSaveAndPublish?: boolean;
}

export function CountryForm(props: Readonly<CountryFormProps>): ReactNode {
  const {
    initialAssets,
    formAction,
    formId,
    isDefaultLocale = true,
    country,
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
    showSaveAndPublish,
  } = props;

  const t = useExtracted();

  const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

  const [selectedImage, setSelectedImage] = useState<{ key: string; url: string } | null>(
    country?.image ?? null,
  );

  return (
    <FormLayout>
      <Form action={action} className="flex flex-col gap-y-6" id={formId} state={state}>
        <FormSection description={t("Enter the country details.")} title={t("Details")}>
          <TextField defaultValue={country?.name} isRequired={true} name="name">
            <Label>{t("Name")}</Label>
            <Input />
            <FieldError />
          </TextField>

          {isDefaultLocale ? (
            <TextField defaultValue={country?.acronym ?? undefined} name="acronym">
              <Label>{t("Acronym")}</Label>
              <Input />
              <FieldError />
            </TextField>
          ) : (
            <div className="flex flex-col gap-y-1">
              <Label>{t("Acronym")}</Label>
              <p className="text-sm">{country?.acronym ?? t("Not set")}</p>
              <Description>{t("Editable only in the default locale.")}</Description>
              {country?.acronym != null ? (
                <input name="acronym" type="hidden" value={country.acronym} />
              ) : null}
            </div>
          )}

          <TextField defaultValue={country?.summary ?? undefined} name="summary">
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
            initialBlocks={country?.descriptionContentBlocks}
            initialAssets={initialAssets}
            name="description"
          />
        </FormSection>

        <Separator className="my-6" />

        {initialSocialMediaItems != null && initialSocialMediaTotal != null ? (
          <Fragment>
            <SocialMediaRelationsFields
              description={t("Link social media accounts to this country.")}
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

        {country != null ? (
          <Fragment>
            <input name="id" type="hidden" value={country.id} />
            <input name="documentId" type="hidden" value={country.entityVersion.entity.id} />
          </Fragment>
        ) : null}

        <EntityFormActions
          entityName={t("Country")}
          isPending={isPending}
          showSaveAndPublish={showSaveAndPublish}
          state={state}
        />
      </Form>
    </FormLayout>
  );
}
