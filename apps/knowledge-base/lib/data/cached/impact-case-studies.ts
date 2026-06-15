import { cache } from "react";

import {
	getImpactCaseStudies as _getImpactCaseStudies,
	getImpactCaseStudyById as _getImpactCaseStudyById,
} from "@/lib/data/impact-case-studies";

export const getImpactCaseStudies = cache(_getImpactCaseStudies);
export const getImpactCaseStudyById = cache(_getImpactCaseStudyById);
