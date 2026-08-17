"use client";

import type * as schema from "@dariah-eric/database/schema";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { LocaleSelector } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/locale-selector";
import { EventForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_components/event-form";
import { discardEventDraftAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_lib/discard-event-draft.action";
import { publishEventAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_lib/publish-event.action";
import { updateEventAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_lib/update-event.action";

interface EventEditFormProps {
  initialAssets: Array<{ key: string; label: string; url: string }>;
  contentBlocks: Array<ContentBlock>;
  documentId: string;
  hasDraftChanges: boolean;
  isDefaultLocale: boolean;
  isPublished: boolean;
  locales: Array<{ code: string; name: string }>;
  selectedLocaleCode: string;
  event: Pick<
    schema.Event,
    "id" | "duration" | "isFullDay" | "location" | "title" | "summary" | "website"
  > & {
    entityVersion: {
      entity: { id: string };
      slug: { value: string };
      status: { type: string };
    };
  } & { image: { key: string; label: string; url: string } };
  initialRelatedEntityIds: Array<string>;
  initialRelatedEntityItems: Array<{ id: string; name: string; description?: string }>;
  initialRelatedEntityTotal: number;
  initialRelatedResourceIds: Array<string>;
  initialRelatedResourceItems: Array<{ id: string; name: string; description?: string }>;
  initialRelatedResourceTotal: number;
  selectedRelatedEntities: Array<{ id: string; name: string; description?: string }>;
  selectedRelatedResources: Array<{ id: string; name: string; description?: string }>;
}

export function EventEditForm(props: Readonly<EventEditFormProps>): ReactNode {
  const {
    initialAssets,
    contentBlocks,
    documentId,
    hasDraftChanges,
    isDefaultLocale,
    isPublished,
    locales,
    selectedLocaleCode,
    event,
    initialRelatedEntityIds,
    initialRelatedEntityItems,
    initialRelatedEntityTotal,
    initialRelatedResourceIds,
    initialRelatedResourceItems,
    initialRelatedResourceTotal,
    selectedRelatedEntities,
    selectedRelatedResources,
  } = props;

  const t = useExtracted();
  const formId = "event-edit-form";

  return (
    <Fragment>
      <EntityFormHeader
        title={t("Edit event")}
        lifecycle={{
          documentId,
          hasDraft: hasDraftChanges,
          isPublished,
          publishAction: publishEventAction,
          discardDraftAction: discardEventDraftAction,
        }}
        localeSelector={
          <LocaleSelector locales={locales} selectedLocaleCode={selectedLocaleCode} />
        }
      />

      <EventForm
        key={event.id}
        contentBlocks={contentBlocks}
        event={event}
        formAction={updateEventAction}
        formId={formId}
        isDefaultLocale={isDefaultLocale}
        initialAssets={initialAssets}
        initialRelatedEntityIds={initialRelatedEntityIds}
        initialRelatedEntityItems={initialRelatedEntityItems}
        initialRelatedEntityTotal={initialRelatedEntityTotal}
        initialRelatedResourceIds={initialRelatedResourceIds}
        initialRelatedResourceItems={initialRelatedResourceItems}
        initialRelatedResourceTotal={initialRelatedResourceTotal}
        selectedRelatedEntities={selectedRelatedEntities}
        selectedRelatedResources={selectedRelatedResources}
      />
    </Fragment>
  );
}
