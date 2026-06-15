import { cache } from "react";

import {
	getSpotlightArticleById as _getSpotlightArticleById,
	getSpotlightArticles as _getSpotlightArticles,
} from "@/lib/data/spotlight-articles";

export const getSpotlightArticleById = cache(_getSpotlightArticleById);
export const getSpotlightArticles = cache(_getSpotlightArticles);
