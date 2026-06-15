import { cache } from "react";

import { getEventById as _getEventById, getEvents as _getEvents } from "@/lib/data/events";

export const getEventById = cache(_getEventById);
export const getEvents = cache(_getEvents);
