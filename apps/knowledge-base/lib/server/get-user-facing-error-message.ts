import { getUserFacingDatabaseError } from "@/lib/db/errors";
import { findUserFacingError } from "@/lib/user-facing-error";

interface ErrorMessages {
	documentLinkedToUser: string;
	entitySlugConflict: string;
	invalidData: string;
	missingDariahEric: string;
	missingData: string;
	missingPairedRelationUnit: string;
	missingRelatedRecord: string;
	publishedSlugRename: string;
	recordConflict: string;
	relationEndBeforeStart: string;
	relationNotEndable: string;
	relationPeriodOverlap: string;
	serviceKpiConflict: string;
	slugTooLong: string;
	socialMediaKpiConflict: string;
	uniqueConflict: string;
}

/** Returns a safe message for a recognised error, or null for unexpected failures. */
export function getUserFacingErrorMessage(error: unknown, messages: ErrorMessages): string | null {
	// A deliberately raised application error wins over the database-error inference: it carries the
	// precise reason, whereas the driver-code path can only guess from a generic constraint failure.
	const appError = findUserFacingError(error);
	if (appError != null) {
		switch (appError.kind) {
			case "document-linked-to-user": {
				return messages.documentLinkedToUser;
			}
			case "entity-slug-conflict": {
				return messages.entitySlugConflict;
			}
			case "missing-dariah-eric": {
				return messages.missingDariahEric;
			}
			case "missing-paired-relation-unit": {
				return messages.missingPairedRelationUnit;
			}
			case "published-slug-rename": {
				return messages.publishedSlugRename;
			}
			case "relation-end-before-start": {
				return messages.relationEndBeforeStart;
			}
			case "relation-not-endable": {
				return messages.relationNotEndable;
			}
			case "relation-period-overlap": {
				return messages.relationPeriodOverlap;
			}
			case "service-kpi-conflict": {
				return messages.serviceKpiConflict;
			}
			case "slug-too-long": {
				return messages.slugTooLong;
			}
			case "social-media-kpi-conflict": {
				return messages.socialMediaKpiConflict;
			}
		}
	}

	switch (getUserFacingDatabaseError(error)) {
		case "entity-slug-conflict": {
			return messages.entitySlugConflict;
		}
		case "unique-conflict": {
			return messages.uniqueConflict;
		}
		case "missing-related-record": {
			return messages.missingRelatedRecord;
		}
		case "record-conflict": {
			return messages.recordConflict;
		}
		case "invalid-data": {
			return messages.invalidData;
		}
		case "missing-data": {
			return messages.missingData;
		}
		case null: {
			return null;
		}
	}
}
