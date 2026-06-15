import { cache } from "react";

import {
	getOpportunities as _getOpportunities,
	getOpportunityById as _getOpportunityById,
} from "@/lib/data/opportunities";

export const getOpportunityById = cache(_getOpportunityById);
export const getOpportunities = cache(_getOpportunities);
