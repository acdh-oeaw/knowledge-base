import { cache } from "react";

import {
	getFundingCallById as _getFundingCallById,
	getFundingCalls as _getFundingCalls,
} from "@/lib/data/funding-calls";

export const getFundingCallById = cache(_getFundingCallById);
export const getFundingCalls = cache(_getFundingCalls);
