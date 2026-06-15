import * as v from "valibot";

export const StatisticsSchema = v.pipe(
	v.object({
		memberCountries: v.number(),
		partnerInstitutions: v.number(),
		cooperatingPartners: v.number(),
		workingGroups: v.number(),
	}),
	v.description("Statistics"),
	v.metadata({ ref: "GetStatistics" }),
);

export type Statistics = v.InferOutput<typeof StatisticsSchema>;

export const GetStatistics = {
	ResponseSchema: v.pipe(
		StatisticsSchema,
		v.description("statistics for organisational units"),
		v.metadata({ ref: "GetStatisticsResponse" }),
	),
};
