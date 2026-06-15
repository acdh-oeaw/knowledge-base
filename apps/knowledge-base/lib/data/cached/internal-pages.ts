import { cache } from "react";

import { getInternalPages as _getInternalPages } from "@/lib/data/internal-pages";

export const getInternalPages = cache(_getInternalPages);
