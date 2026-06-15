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
