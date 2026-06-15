import { cache } from "react";

import {
	getDocumentationPageById as _getDocumentationPageById,
	getDocumentationPages as _getDocumentationPages,
} from "@/lib/data/documentation-pages";

export const getDocumentationPageById = cache(_getDocumentationPageById);
export const getDocumentationPages = cache(_getDocumentationPages);
