"use client";

import type * as schema from "@dariah-eric/database/schema";
import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Checkbox } from "@dariah-eric/ui/checkbox";
import { DatePicker, DatePickerTrigger } from "@dariah-eric/ui/date-picker";
import { Description, FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { Input } from "@dariah-eric/ui/input";
import { Separator } from "@dariah-eric/ui/separator";
import { TextField } from "@dariah-eric/ui/text-field";
import { TextArea } from "@dariah-eric/ui/textarea";
import { CalendarDate } from "@internationalized/date";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import {
  type ContentBlock,
  ContentBlocks,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormActions } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form-actions";
import { EntityRelationsFields } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-relations-fields";
import {
  FormLayout,
  FormSection,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { ImageSelectField } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/image-select-field";
import type { ServerAction } from "@/lib/server/create-server-action";

interface EventFormProps {
  initialAssets: Array<{ key: string; label: string; url: string }>;
  contentBlocks?: Array<ContentBlock>;
  /**
   * `duration`/`location` aren't translatable — the DB keeps them synced from the default locale's
   * version regardless, so this locks their inputs when editing another locale. Defaults to `true`
   * (the create form has no locale concept, and always starts in the default locale).
   */
  isDefaultLocale?: boolean;
  event?: Pick<
    schema.Event,
    "id" | "duration" | "isFullDay" | "location" | "title" | "summary" | "website"
  > & {
    entityVersion: { entity: { id: string }; slug: { value: string } };
  } & { image: { key: string; label: string; url: string } };
  formId?: string;
  formAction: ServerAction;
  initialRelatedEntityIds?: Array<string>;
  initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
  initialRelatedEntityTotal: number;
  initialRelatedResourceIds?: Array<string>;
  initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
  initialRelatedResourceTotal: number;
  selectedRelatedEntities?: Array<{ id: string; name: string; description?: string }>;
  selectedRelatedResources?: Array<{ id: string; name: string; description?: string }>;
  showRelationFields?: boolean;
}

export function EventForm(props: Readonly<EventFormProps>): ReactNode {
  const {
    initialAssets,
    contentBlocks,
    formAction,
    formId,
    isDefaultLocale = true,
    event,
    initialRelatedEntityIds,
    initialRelatedEntityItems,
    initialRelatedEntityTotal,
    initialRelatedResourceIds,
    initialRelatedResourceItems,
    initialRelatedResourceTotal,
    selectedRelatedEntities,
    selectedRelatedResources,
    showRelationFields = true,
  } = props;

  const t = useExtracted();

  const [state, action, isPending] = useActionState(formAction, createActionStateInitial());

  const [selectedImage, setSelectedImage] = useState<{ key: string; url: string } | null>(
    event?.image ?? null,
  );
  return (
    <FormLayout>
      <Form action={action} className="flex flex-col gap-y-6" id={formId} state={state}>
        <FormSection description={t("Enter the event details.")} title={t("Details")}>
          <TextField defaultValue={event?.title} isRequired={true} name="title">
            <Label>{t("Title")}</Label>
            <Input />
            <FieldError />
          </TextField>

          <TextField defaultValue={event?.summary ?? undefined} isRequired={true} name="summary">
            <Label>{t("Summary")}</Label>
            <TextArea rows={5} />
            <FieldError />
          </TextField>
          {isDefaultLocale ? (
            <Fragment>
              <DatePicker
                defaultValue={
                  event != null
                    ? new CalendarDate(
                        event.duration.start.getUTCFullYear(),
                        event.duration.start.getUTCMonth() + 1,
                        event.duration.start.getUTCDate(),
                      )
                    : undefined
                }
                granularity="day"
                isRequired={true}
                name="duration.start"
              >
                <Label>{t("Start date")}</Label>
                <DatePickerTrigger />
                <FieldError />
              </DatePicker>

              <DatePicker
                defaultValue={
                  event?.duration.end != null
                    ? new CalendarDate(
                        event.duration.end.getUTCFullYear(),
                        event.duration.end.getUTCMonth() + 1,
                        event.duration.end.getUTCDate(),
                      )
                    : undefined
                }
                granularity="day"
                name="duration.end"
              >
                <Label>{t("End date")}</Label>
                <DatePickerTrigger />
                <FieldError />
              </DatePicker>
            </Fragment>
          ) : (
            <div className="flex flex-col gap-y-1">
              <Label>{t("Duration")}</Label>
              <p className="text-sm">
                {event != null
                  ? `${event.duration.start.toISOString().slice(0, 10)}${
                      event.duration.end != null
                        ? ` – ${event.duration.end.toISOString().slice(0, 10)}`
                        : ""
                    }`
                  : null}
              </p>
              <Description>{t("Editable only in the default locale.")}</Description>
              {event != null ? (
                <Fragment>
                  <input
                    name="duration.start"
                    type="hidden"
                    value={event.duration.start.toISOString().slice(0, 10)}
                  />
                  {event.duration.end != null ? (
                    <input
                      name="duration.end"
                      type="hidden"
                      value={event.duration.end.toISOString().slice(0, 10)}
                    />
                  ) : null}
                </Fragment>
              ) : null}
            </div>
          )}
          {isDefaultLocale ? (
            <Checkbox defaultSelected={event?.isFullDay ?? false} name="isFullDay" value="true">
              {t("Full day")}
            </Checkbox>
          ) : (
            <div className="flex flex-col gap-y-1">
              <Label>{t("Full day")}</Label>
              <p className="text-sm">{event?.isFullDay ? t("Yes") : t("No")}</p>
              <Description>{t("Editable only in the default locale.")}</Description>
              {event?.isFullDay ? <input name="isFullDay" type="hidden" value="true" /> : null}
            </div>
          )}
          {isDefaultLocale ? (
            <TextField
              defaultValue={event?.location ?? undefined}
              isRequired={true}
              name="location"
            >
              <Label>{t("Location")}</Label>
              <Input />
              <FieldError />
            </TextField>
          ) : (
            <div className="flex flex-col gap-y-1">
              <Label>{t("Location")}</Label>
              <p className="text-sm">{event?.location ?? t("Not set")}</p>
              <Description>{t("Editable only in the default locale.")}</Description>
              {event?.location != null ? (
                <input name="location" type="hidden" value={event.location} />
              ) : null}
            </div>
          )}
          <TextField defaultValue={event?.website ?? undefined} name="website" type="url">
            <Label>{t("Website")}</Label>
            <Input placeholder="https://" />
            <FieldError />
          </TextField>
        </FormSection>

        <Separator className="my-6" />

        <FormSection
          description={t("Select or upload an image.")}
          isRequired={true}
          title={t("Image")}
        >
          <ImageSelectField
            defaultPrefix="images"
            initialAssets={initialAssets}
            isRequired={true}
            onChange={setSelectedImage}
            prefixes={["avatars", "images", "logos"]}
            selectedImage={selectedImage}
          />
        </FormSection>

        <Separator className="my-6" />

        {showRelationFields ? (
          <Fragment>
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

            <Separator className="my-6" />
          </Fragment>
        ) : null}

        <FormSection description={t("Add the content.")} title={t("Content")} variant="stacked">
          <ContentBlocks initialAssets={initialAssets} items={contentBlocks ?? []} />
        </FormSection>

        {event != null ? (
          <Fragment>
            <input name="id" type="hidden" value={event.id} />
            <input name="documentId" type="hidden" value={event.entityVersion.entity.id} />
          </Fragment>
        ) : null}

        <EntityFormActions entityName={t("Event")} isPending={isPending} state={state} />
      </Form>
    </FormLayout>
  );
}
