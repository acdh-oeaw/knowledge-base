import { cache } from "react";

import {
	getPersonCreateDataForAdmin as _getPersonCreateDataForAdmin,
	getPersonsForAdmin as _getPersonsForAdmin,
} from "@/lib/data/persons";

export const getPersonsForAdmin = cache(_getPersonsForAdmin);
export const getPersonCreateDataForAdmin = cache(_getPersonCreateDataForAdmin);
