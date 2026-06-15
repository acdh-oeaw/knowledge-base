/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { db } from "@/lib/db";

export async function getLicenseOptions() {
	return db.query.licenses.findMany({
		columns: {
			id: true,
			code: true,
			name: true,
		},
		orderBy: {
			code: "asc",
		},
	});
}
