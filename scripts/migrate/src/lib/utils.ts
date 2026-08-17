import { appendFileSync } from "node:fs";
import path from "node:path";

import { type Database, type Transaction, schema } from "@dariah-eric/database";
import type { ContentBlockTypes } from "@dariah-eric/database/schema";
import type { StorageService } from "@dariah-eric/storage";
import type { AssetPrefix } from "@dariah-eric/storage/config";
import { buffer } from "@dariah-eric/storage/lib";
import { assert } from "@acdh-oeaw/lib";
import { generateJSON } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";

import { assetsPath } from "../../config/data-migration.config";
interface ParsedEvent {
  duration: {
    start: Date;
    end?: Date;
  };
  location: string;
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const TZ = /^(UTC|GMT|CET|CEST|EST|EDT|PST|PDT|BST|[+-]\d{2}:?\d{2})$/i;
const DEFAULT_DATE = new Date(Date.UTC(1900, 0, 1));

function toUTC(day: number, month: number, year: number): Date {
  if (year < 100) {
    year += 2000;
  }
  return new Date(Date.UTC(year, month, day));
}

export function parseEventSummary(summary: string): ParsedEvent {
  const head: string = (summary.replaceAll("\\", "").split(":")[0] ?? "").trim();
  let start: Date | null = null;
  let end: Date | null = null;

  // Range, optional start month/year: "28.9.-1.10.2026", "24.-25.10.25", "08.-12.07.2024", "8. – 10.2.2023"
  const range =
    /(\d{1,2})\.(?:(\d{1,2})\.)?(?:(\d{2,4})\.?)?\s*[–-]\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(
      head,
    );
  // Day-first named month: "4 Oct. 2022", "29. Nov. 2022"
  const namedDM = /(\d{1,2})\.?\s+([A-Za-z]{3,})\.?\s+(\d{4})/.exec(head);
  // Month-first named, optional year: "Oct. 19", "Oct. 19 2022"
  const namedMD = /\b([A-Za-z]{3,})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/.exec(head);
  // Single numeric: "10.03.2025", "23.1.24"
  const numeric = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(head);

  if (range) {
    const sd = Number(range[1]); // start day
    const ed = Number(range[4]); // end day
    const em = Number(range[5]) - 1; // end month
    const ey = Number(range[6]); // end year
    const sm = range[2] ? Number(range[2]) - 1 : em; // start month (fallback: end's)
    const sy = range[3] ? Number(range[3]) : ey; // start year  (fallback: end's)
    start = toUTC(sd, sm, sy);
    end = toUTC(ed, em, ey);
  } else if (namedDM) {
    const month = namedDM[2] != null ? MONTHS[namedDM[2].slice(0, 3).toLowerCase()] : undefined;
    if (month !== undefined) {
      start = toUTC(Number(namedDM[1]), month, Number(namedDM[3]));
      end = start;
    }
  } else if (namedMD?.[1] != null && MONTHS[namedMD[1].slice(0, 3).toLowerCase()] !== undefined) {
    const month = MONTHS[namedMD[1].slice(0, 3).toLowerCase()];
    const year = namedMD[3] ? Number(namedMD[3]) : new Date().getUTCFullYear();
    start = month != null ? toUTC(Number(namedMD[2]), month, year) : null;
    end = start;
  } else if (numeric) {
    start = toUTC(Number(numeric[1]), Number(numeric[2]) - 1, Number(numeric[3]));
    end = start;
  }

  // Location: prefer a non-timezone parenthetical, then a bare keyword.
  const parens = [...head.matchAll(/\(([^)]+)\)/g)]
    .map((m) => (m.length > 0 ? m[1]?.trim() : undefined))
    .filter((p): p is string => p !== undefined);
  const nonTz = parens.find((p) => !TZ.test(p));
  const keyword = /\b(hybrid|online|onsite|on[- ]site|in[- ]person)\b/i.exec(head)?.[1];
  const location = (nonTz ?? keyword)?.trim() ?? "";

  start = start ?? DEFAULT_DATE;

  const duration: ParsedEvent["duration"] = { start };
  if (end && end.getTime() !== start.getTime()) {
    duration.end = end;
  }

  return { duration, location };
}

/**
 * Helper functions taken from the app/knowledge-base lib resp.
 * https://github.com/DARIAH-ERIC/knowledge-base *
 */

export async function createVersionRow(
  tx: Transaction,
  documentId: string,
  statusType: "draft" | "published",
  localeId: string,
): Promise<string> {
  const status = await tx.query.entityStatus.findFirst({
    where: { type: statusType },
    columns: { id: true },
  });
  assert(status, `Entity status "${statusType}" not found in database.`);

  const [version] = await tx
    .insert(schema.entityVersions)
    .values({ entityId: documentId, statusId: status.id, localeId })
    .returning({ id: schema.entityVersions.id });
  assert(version);

  return version.id;
}

export async function createPublishedDocument(
  tx: Transaction,
  typeId: string,
  slug: string,
  localeId: string,
): Promise<{ documentId: string; versionId: string }> {
  const [document] = await tx
    .insert(schema.entities)
    .values({ typeId })
    .returning({ id: schema.entities.id });
  assert(document);

  const versionId = await createVersion(tx, typeId, slug, document.id, localeId);

  return { documentId: document.id, versionId };
}

export async function createVersion(
  tx: Transaction,
  typeId: string,
  slug: string,
  documentId: string,
  localeId: string,
): Promise<string> {
  const versionId = await createVersionRow(tx, documentId, "published", localeId);
  await tx.insert(schema.slugs).values({
    entityVersionId: versionId,
    entityId: documentId,
    typeId,
    localeId,
    isPublished: true,
    value: slug,
  });
  return versionId;
}

export function logToFile(message: string, filepath = "migration.log"): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  appendFileSync(filepath, line);
}

export function createSortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return name;
  }

  const lastName = parts.at(-1)!;
  const firstNames = parts.slice(0, -1).join(" ");

  return `${lastName}, ${firstNames}`;
}

export async function createAsset(
  db: Database,
  storage: StorageService,
  assetPrefix: string,
  imagePath: string,
  assetName: string,
): Promise<string | undefined> {
  //const imageUrl = new URL(`${assetsGithubPath}${imagePath}`);
  //const imageResponse = await fetch(imageUrl, { method: "HEAD" });
  //const size = Number(imageResponse.headers.get("content-length"));
  /*if (size > assetSizeLimit) {
		logToFile(`image too big. resize and upload manually. ${String(imageUrl)}`);
		return;
	}*/
  const prefix = assetPrefix as AssetPrefix;
  //const input = await buffer.fromUrl(imageUrl);

  const input = await buffer.fromFilePath(
    path.resolve(import.meta.dirname, assetsPath, imagePath.slice(1)),
  );
  const metadata = await buffer.getMetadata(input);
  const label = assetName;
  const { key } = (await storage.upload({ prefix, input, metadata })).unwrap();

  assert(label);

  const [asset] = await db
    .insert(schema.assets)
    .values({
      key,
      label,
      mimeType: metadata["content-type"],
      caption: "",
      alt: "",
      size: metadata.size,
    })
    .returning({ id: schema.assets.id });

  return asset?.id;
}

export async function addSocialMediaRelationForOrganisationalUnit(
  tx: Transaction,
  name: string,
  typeId: string,
  url: string,
  organisationalUnitId: string,
): Promise<void> {
  const [kbSocialMedia] = await tx
    .insert(schema.socialMedia)
    .values({
      name,
      typeId,
      url,
      duration: {
        start: new Date(Date.UTC(1900, 0, 1)),
      },
    })
    .returning({ id: schema.socialMedia.id });

  assert(kbSocialMedia);

  await tx.insert(schema.organisationalUnitsToSocialMedia).values({
    organisationalUnitId,
    socialMediaId: kbSocialMedia.id,
  });
}

export async function addSocialMediaRelationForPerson(
  tx: Transaction,
  name: string,
  typeId: string,
  url: string,
  personId: string,
): Promise<void> {
  const [kbSocialMedia] = await tx
    .insert(schema.socialMedia)
    .values({
      name,
      typeId,
      url,
      duration: {
        start: new Date(Date.UTC(1900, 0, 1)),
      },
    })
    .returning({ id: schema.socialMedia.id });

  assert(kbSocialMedia);

  await tx.insert(schema.personsToSocialMedia).values({
    personId,
    socialMediaId: kbSocialMedia.id,
  });
}

export async function createFieldAndContentBlock(
  tx: Transaction,
  content: string | null,
  entityTypeId: string,
  fieldName: string,
  entityVersionId: string,
  contentBlockType: ContentBlockTypes,
): Promise<void> {
  const ct = generateJSON(content ?? "", [StarterKit]);
  const fN = await tx.query.entityTypesFieldsNames.findFirst({
    where: {
      entityTypeId,
      fieldName,
    },
  });
  assert(fN);

  const [field] = await tx
    .insert(schema.fields)
    .values({
      entityVersionId,
      fieldNameId: fN.id,
    })
    .returning({ id: schema.fields.id });

  assert(field);

  const [contentBlock] = await tx
    .insert(schema.contentBlocks)
    .values({
      position: 0,
      fieldId: field.id,
      typeId: contentBlockType.id,
    })
    .returning({ id: schema.contentBlocks.id });

  assert(contentBlock);

  // oxlint-disable-next-line typescript/switch-exhaustiveness-check
  switch (contentBlockType.type) {
    case "rich_text": {
      await tx.insert(schema.richTextContentBlocks).values({
        content: ct,
        id: contentBlock.id,
      });
    }
  }

  assert(contentBlock);
}
