"use client";

import { Heading } from "@acdh-knowledge-base/ui/heading";
import type { ReactNode } from "react";

import { EntityLifecycleBar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-bar";

/** Lifecycle command actions wrapped by createCommandAction return an ActionState on completion. */
type LifecycleAction = (documentId: string) => Promise<unknown>;

interface EntityFormHeaderProps {
	title: string;
	/**
	 * When provided, renders the lifecycle bar (publish / discard / status badge) next to the
	 * heading. Omit for create forms or for non-versioned entities (users, etc.).
	 */
	lifecycle?: {
		documentId: string;
		isPublished: boolean;
		hasDraft: boolean;
		editHref?: string;
		publishAction?: LifecycleAction;
		discardDraftAction?: LifecycleAction;
	};
}

export function EntityFormHeader(props: Readonly<EntityFormHeaderProps>): ReactNode {
	const { title, lifecycle } = props;

	if (lifecycle == null) {
		return <Heading>{title}</Heading>;
	}

	return (
		<div className="flex items-center justify-between">
			<Heading>{title}</Heading>
			<EntityLifecycleBar
				discardDraftAction={lifecycle.discardDraftAction}
				documentId={lifecycle.documentId}
				editHref={lifecycle.editHref}
				hasDraft={lifecycle.hasDraft}
				isPublished={lifecycle.isPublished}
				publishAction={lifecycle.publishAction}
			/>
		</div>
	);
}
