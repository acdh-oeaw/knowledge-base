import { cache } from "react";

import {
	getAssets as _getAssets,
	getAssetsForDashboard as _getAssetsForDashboard,
} from "@/lib/data/assets";

export const getAssets = cache(_getAssets);
export const getAssetsForDashboard = cache(_getAssetsForDashboard);
