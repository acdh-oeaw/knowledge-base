export function serializeDateRange(range: { start: Date; end?: Date | null }): {
	start: string;
	end: string | undefined;
} {
	return {
		start: range.start.toISOString(),
		end: range.end?.toISOString(),
	};
}
