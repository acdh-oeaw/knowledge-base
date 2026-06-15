import { cache } from "react";

import { getNationalConsortiaForAdmin as _getNationalConsortiaForAdmin } from "@/lib/data/national-consortia";

export const getNationalConsortiaForAdmin = cache(_getNationalConsortiaForAdmin);
