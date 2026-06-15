import { cache } from "react";

import { getGovernanceBodiesForAdmin as _getGovernanceBodiesForAdmin } from "@/lib/data/governance-bodies";

export const getGovernanceBodiesForAdmin = cache(_getGovernanceBodiesForAdmin);
