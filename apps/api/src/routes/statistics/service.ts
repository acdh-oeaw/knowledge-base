/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import type { Database, Transaction } from "@/middlewares/db";

export async function getStatistics(db: Database | Transaction) {
	const item = await db.query.statistics.findFirst({
		columns: {
			memberCountries: true,
			partnerInstitutions: true,
			cooperatingPartners: true,
			workingGroups: true,
		},
	});

	return (
		item ?? {
			memberCountries: 0,
			partnerInstitutions: 0,
			cooperatingPartners: 0,
			workingGroups: 0,
		}
	);
}
