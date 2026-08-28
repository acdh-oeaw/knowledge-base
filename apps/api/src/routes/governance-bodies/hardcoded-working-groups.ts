/** Working groups have no governance body entity in the database, so the api synthesises one. */

const summary =
	"Self-organised communities of practice within DARIAH which contribute to state-of-the-art digital arts and humanities activities, scaling their results to a European level.";

export const hardcodedWorkingGroupsGovernanceBody = {
	id: "019b7a56-b301-7f93-9d24-91333bdc3ca8",
	name: "Working groups",
	acronym: null,
	summary,
	metadata: {},
	image: null,
	entity: { slug: "working-groups" },
	publishedAt: "2026-01-01T00:00:00.000Z",
	socialMedia: [],
	description: [
		{
			type: "rich_text",
			content: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{
								type: "text",
								text: summary,
							},
						],
					},
				],
			},
		},
	],
};
