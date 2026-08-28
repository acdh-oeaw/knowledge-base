import type * as schema from "@dariah-eric/database/schema";

import { documentationPagesLifecycleAdapter } from "@/lib/data/documentation-pages.lifecycle-adapter";
import { documentsPoliciesLifecycleAdapter } from "@/lib/data/documents-policies.lifecycle-adapter";
import type { EntityLifecycleAdapter } from "@/lib/data/entity-lifecycle";
import { eventsLifecycleAdapter } from "@/lib/data/events.lifecycle-adapter";
import { fundingCallsLifecycleAdapter } from "@/lib/data/funding-calls.lifecycle-adapter";
import { impactCaseStudiesLifecycleAdapter } from "@/lib/data/impact-case-studies.lifecycle-adapter";
import { internalPagesLifecycleAdapter } from "@/lib/data/internal-pages.lifecycle-adapter";
import { newsLifecycleAdapter } from "@/lib/data/news.lifecycle-adapter";
import { opportunitiesLifecycleAdapter } from "@/lib/data/opportunities.lifecycle-adapter";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { pagesLifecycleAdapter } from "@/lib/data/pages.lifecycle-adapter";
import { personsLifecycleAdapter } from "@/lib/data/persons.lifecycle-adapter";
import { projectsLifecycleAdapter } from "@/lib/data/projects.lifecycle-adapter";
import { spotlightArticlesLifecycleAdapter } from "@/lib/data/spotlight-articles.lifecycle-adapter";

export type EntityType = schema.EntityType["type"];

/**
 * Central registry mapping each entity-type token to its lifecycle adapter. Every versioned entity
 * type has exactly one adapter that owns its subtype table; the generic lifecycle helpers in
 * `entity-lifecycle.ts` take an adapter argument, but callers that only know the type token at
 * runtime (e.g. the maintenance merge and duplicate tools, which operate over an arbitrary picked
 * entity) resolve it here.
 *
 * Every entity type currently has an adapter, but the registry stays partial and lookups stay
 * guarded: callers resolve a type token read from the database, so an unregistered type has to fail
 * with a clear error rather than a missing-key crash.
 */
const lifecycleAdapters = {
	documentation_pages: documentationPagesLifecycleAdapter,
	documents_policies: documentsPoliciesLifecycleAdapter,
	events: eventsLifecycleAdapter,
	funding_calls: fundingCallsLifecycleAdapter,
	impact_case_studies: impactCaseStudiesLifecycleAdapter,
	internal_pages: internalPagesLifecycleAdapter,
	news: newsLifecycleAdapter,
	opportunities: opportunitiesLifecycleAdapter,
	organisational_units: organisationalUnitsLifecycleAdapter,
	pages: pagesLifecycleAdapter,
	persons: personsLifecycleAdapter,
	projects: projectsLifecycleAdapter,
	spotlight_articles: spotlightArticlesLifecycleAdapter,
} satisfies Partial<Record<EntityType, EntityLifecycleAdapter>>;

/** Entity types with a lifecycle adapter — the types merge and duplicate can operate on. */
export type AdaptedEntityType = keyof typeof lifecycleAdapters;

export const adaptedEntityTypes = new Set(
	Object.keys(lifecycleAdapters) as Array<AdaptedEntityType>,
);

export function hasLifecycleAdapter(type: string): type is AdaptedEntityType {
	return Object.hasOwn(lifecycleAdapters, type);
}

/** Resolve the lifecycle adapter for an entity type that has one. */
export function getLifecycleAdapter(type: AdaptedEntityType): EntityLifecycleAdapter {
	return lifecycleAdapters[type];
}
