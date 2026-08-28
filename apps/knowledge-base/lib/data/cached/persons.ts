import { cache } from "react";

import { getPersonsForAdmin as _getPersonsForAdmin } from "@/lib/data/persons";

export const getPersonsForAdmin = cache(_getPersonsForAdmin);
