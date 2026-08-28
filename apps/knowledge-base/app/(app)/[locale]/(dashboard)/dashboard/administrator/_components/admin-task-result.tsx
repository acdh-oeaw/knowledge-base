"use client";

import { Link } from "@dariah-eric/ui/link";
import { useExtracted, useFormatter } from "next-intl";
import type { ReactNode } from "react";

import type {
	BackgroundJobResult,
	IngestSshocServicesJobResult,
	SshocServiceRef,
	SyncSearchIndexJobResult,
	UnmappedActorRef,
} from "@/lib/admin-tasks/background-job-result";

interface AdminTaskResultProps {
	result: BackgroundJobResult;
}

/** Render a completed job's report. Falls back to raw JSON for unrecognised shapes. */
export function AdminTaskResult(props: Readonly<AdminTaskResultProps>): ReactNode {
	const { result } = props;

	switch (result.kind) {
		case "ingest_sshoc_services": {
			return <IngestSshocServicesResultView result={result} />;
		}
		case "sync_resources_search_index":
		case "sync_website_search_index": {
			return <SyncSearchIndexResultView result={result} />;
		}
		case "unknown": {
			return (
				<pre className="overflow-auto font-mono text-[11px]">
					{JSON.stringify(result.value, null, 2)}
				</pre>
			);
		}
	}
}

function Stat(props: Readonly<{ label: string; value: number; intent?: "attention" }>): ReactNode {
	const { label, value, intent } = props;

	const format = useFormatter();

	return (
		// `flex-col-reverse` keeps the value above its label visually while `dt` still precedes `dd`.
		<div className="flex flex-col-reverse">
			<dt className="text-xs text-muted-fg">{label}</dt>
			<dd
				className={
					intent === "attention" && value > 0
						? // `warning-fg` is meant for text *on* a warning background; on the card background
							// the tinted `warning-subtle-fg` is the readable one.
							"text-sm font-semibold text-warning-subtle-fg tabular-nums"
						: "text-sm font-semibold text-fg tabular-nums"
				}
			>
				{format.number(value)}
			</dd>
		</div>
	);
}

function StatList(props: Readonly<{ children: ReactNode }>): ReactNode {
	return <dl className="flex flex-wrap gap-x-6 gap-y-2">{props.children}</dl>;
}

/**
 * A collapsed-by-default list of affected records. Rendered only when there is something to show,
 * so a clean run stays visually quiet. The `summary` stays short enough to read as a one-line
 * affordance in a narrow card — any explanation belongs in `hint`, which only shows once opened.
 */
function DetailSection(
	props: Readonly<{ summary: string; hint?: string; children: ReactNode }>,
): ReactNode {
	const { summary, hint, children } = props;

	return (
		<details className="group border-bs border-muted pbs-2">
			<summary className="cursor-pointer text-xs text-fg hover:text-muted-fg">{summary}</summary>
			<div className="mbs-2 space-y-2">
				{hint != null ? <p className="text-[11px] text-muted-fg">{hint}</p> : null}
				{children}
			</div>
		</details>
	);
}

function ServiceList(props: Readonly<{ services: Array<SshocServiceRef> }>): ReactNode {
	return (
		<ul className="space-y-1">
			{props.services.map((service) => (
				<li key={service.id} className="flex flex-wrap items-baseline gap-x-2">
					<Link
						className="text-xs"
						href={`/dashboard/administrator/sshoc-services/${service.id}/view`}
					>
						{service.name}
					</Link>
					{service.status != null ? (
						<span className="text-[11px] text-muted-fg">({service.status})</span>
					) : null}
					<span className="font-mono text-[11px] text-muted-fg">{service.sshocMarketplaceId}</span>
				</li>
			))}
		</ul>
	);
}

function ActorList(props: Readonly<{ actors: Array<UnmappedActorRef> }>): ReactNode {
	const t = useExtracted();
	const format = useFormatter();

	return (
		<ul className="space-y-1">
			{props.actors.map((actor) => (
				<li key={actor.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
					<span className="text-fg">{actor.name}</span>
					<span className="text-[11px] text-muted-fg">
						{/* Two messages rather than an ICU plural: `t()` types its values as `string`, so a
						    `{count, plural, …}` argument would never resolve as a number. */}
						{actor.serviceCount === 1
							? t("actor {id}, on 1 service", { id: String(actor.id) })
							: t("actor {id}, on {count} services", {
									count: format.number(actor.serviceCount),
									// Not number-formatted: this is an identifier, not a quantity.
									id: String(actor.id),
								})}
					</span>
				</li>
			))}
		</ul>
	);
}

function IngestSshocServicesResultView(
	props: Readonly<{ result: IngestSshocServicesJobResult }>,
): ReactNode {
	const { result } = props;

	const t = useExtracted();
	const format = useFormatter();

	return (
		<div className="space-y-2">
			<StatList>
				<Stat label={t("Fetched")} value={result.fetchedCount} />
				<Stat label={t("Created")} value={result.createdCount} />
				<Stat label={t("Updated")} value={result.updatedCount} />
				<Stat label={t("New relations")} value={result.relationCount} />
				<Stat label={t("Removed relations")} value={result.removedRelationCount} />
				<Stat intent="attention" label={t("Needs review")} value={result.markedNeedsReviewCount} />
			</StatList>

			{!result.hasDetails ? (
				<p className="text-[11px] text-muted-fg">
					{t("This run predates per-service reporting, so only totals are available.")}
				</p>
			) : null}

			{result.markedNeedsReview.length > 0 ? (
				<DetailSection
					hint={t(
						"No longer returned by the marketplace, so their status was set to needs review.",
					)}
					summary={t("Marked as needs review ({count})", {
						count: format.number(result.markedNeedsReview.length),
					})}
				>
					<ServiceList services={result.markedNeedsReview} />
				</DetailSection>
			) : null}

			{result.created.length > 0 ? (
				<DetailSection
					summary={t("Newly created ({count})", { count: format.number(result.created.length) })}
				>
					<ServiceList services={result.created} />
				</DetailSection>
			) : null}

			{result.reappeared.length > 0 ? (
				<DetailSection
					hint={t(
						"Returned by the marketplace again, but their status is not live. Ingest never resets a status, so this has to be done by hand.",
					)}
					summary={t("Back upstream, not live ({count})", {
						count: format.number(result.reappeared.length),
					})}
				>
					<ServiceList services={result.reappeared} />
				</DetailSection>
			) : null}

			{result.unmappedActors.length > 0 ? (
				<DetailSection
					hint={t(
						"No published organisational unit carries these marketplace actor ids, so their owner and provider relations could not be created.",
					)}
					summary={t("Unmatched contributors ({count})", {
						count: format.number(result.unmappedActors.length),
					})}
				>
					<ActorList actors={result.unmappedActors} />
				</DetailSection>
			) : null}
		</div>
	);
}

function SyncSearchIndexResultView(
	props: Readonly<{ result: SyncSearchIndexJobResult }>,
): ReactNode {
	const { result } = props;

	const t = useExtracted();
	const format = useFormatter();

	return (
		<div className="space-y-2">
			<StatList>
				<Stat label={t("Documents indexed")} value={result.count} />
				{result.websiteCount != null ? (
					<Stat label={t("Website documents")} value={result.websiteCount} />
				) : null}
				<Stat intent="attention" label={t("Stale, not removed")} value={result.failedCount} />
			</StatList>

			{result.failedDeletions.length > 0 ? (
				<DetailSection
					hint={t(
						"Documents for content that no longer exists could not be deleted, so they stay findable in search until a later run removes them.",
					)}
					summary={t("Stale, still in the index ({count})", {
						count: format.number(result.failedDeletions.length),
					})}
				>
					<ul className="space-y-1">
						{result.failedDeletions.map((document) => (
							<li
								key={`${document.collection}:${document.documentId}`}
								className="flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] text-muted-fg"
							>
								<span>{document.collection}</span>
								<span className="text-fg">{document.documentId}</span>
							</li>
						))}
					</ul>
				</DetailSection>
			) : null}

			{result.failedCount > 0 && !result.hasDetails ? (
				<p className="text-[11px] text-muted-fg">
					{t("This run predates per-document reporting, so only totals are available.")}
				</p>
			) : null}
		</div>
	);
}
