import { cache } from "react";

import {
	getContentBlockByType as _getContentBlockByType,
	getContentBlockTypes as _getContentBlockTypes,
} from "@/lib/data/content-blocks";

export const getContentBlockByType = cache(_getContentBlockByType);
export const getContentBlockTypes = cache(_getContentBlockTypes);
