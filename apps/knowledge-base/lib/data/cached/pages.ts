import { cache } from "react";

import { getPageById as _getPageById, getPages as _getPages } from "@/lib/data/pages";

export const getPageById = cache(_getPageById);
export const getPages = cache(_getPages);
