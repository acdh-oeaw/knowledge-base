import { cache } from "react";

import { getWorkingGroupsForAdmin as _getWorkingGroupsForAdmin } from "@/lib/data/working-groups";

export const getWorkingGroupsForAdmin = cache(_getWorkingGroupsForAdmin);
