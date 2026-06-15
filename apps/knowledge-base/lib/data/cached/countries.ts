import { cache } from "react";

import { getCountriesForAdmin as _getCountriesForAdmin } from "@/lib/data/countries";

export const getCountriesForAdmin = cache(_getCountriesForAdmin);
