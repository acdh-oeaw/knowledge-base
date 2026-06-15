import { cache } from "react";

import {
	getDocumentOrPolicyById as _getDocumentOrPolicyById,
	getDocumentsPolicies as _getDocumentsPolicies,
} from "@/lib/data/documents-policies";

export const getDocumentsPolicies = cache(_getDocumentsPolicies);
export const getDocumentOrPolicyById = cache(_getDocumentOrPolicyById);
