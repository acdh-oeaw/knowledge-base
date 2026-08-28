import type * as schema from "@dariah-eric/database/schema";

import type { asc, sql } from "@/services/db/sql";

/** Order a many-to-many social-media relation by its junction row. */
export const socialMediaByPosition = {
	orderBy(
		_table: typeof schema.socialMedia,
		operators: { asc: typeof asc; sql: typeof sql },
	): Array<ReturnType<typeof asc>> {
		return [operators.asc(operators.sql.identifier("position")), operators.asc(_table.id)];
	},
};

export function mapSocialMedia<
	T extends {
		type: { type: string };
		duration: { start: Date; end?: Date | null } | null;
	},
>(
	socialMedia: Array<T>,
): Array<
	Omit<T, "type" | "duration"> & {
		type: string;
		duration: { start: string; end: string | null } | null;
	}
> {
	return socialMedia.map((sm) => {
		return {
			...sm,
			type: sm.type.type,
			duration: sm.duration
				? {
						start: sm.duration.start.toISOString(),
						end: sm.duration.end?.toISOString() ?? null,
					}
				: null,
		};
	});
}
