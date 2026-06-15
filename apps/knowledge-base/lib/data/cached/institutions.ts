import { cache } from "react";

import { getInstitutionsForAdmin as _getInstitutionsForAdmin } from "@/lib/data/institutions";

export const getInstitutionsForAdmin = cache(_getInstitutionsForAdmin);
