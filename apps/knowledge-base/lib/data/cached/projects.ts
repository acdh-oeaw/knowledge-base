import { cache } from "react";

import {
	getProjectCreateDataForAdmin as _getProjectCreateDataForAdmin,
	getProjectsForAdmin as _getProjectsForAdmin,
} from "@/lib/data/projects";

export const getProjectsForAdmin = cache(_getProjectsForAdmin);
export const getProjectCreateDataForAdmin = cache(_getProjectCreateDataForAdmin);
