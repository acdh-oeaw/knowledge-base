import { cache } from "react";

import { getNews as _getNews, getNewsItemById as _getNewsItemById } from "@/lib/data/news";

export const getNews = cache(_getNews);
export const getNewsItemById = cache(_getNewsItemById);
