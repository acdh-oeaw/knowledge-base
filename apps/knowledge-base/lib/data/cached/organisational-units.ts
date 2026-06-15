import { cache } from "react";

import {
	getOrganisationalUnitById as _getOrganisationalUnitById,
	getOrganisationalUnits as _getOrganisationalUnits,
} from "@/lib/data/organisational-units";

export const getOrganisationalUnitById = cache(_getOrganisationalUnitById);
export const getOrganisationalUnits = cache(_getOrganisationalUnits);
