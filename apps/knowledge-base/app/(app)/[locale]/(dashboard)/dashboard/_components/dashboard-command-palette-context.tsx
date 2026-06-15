"use client";

import { createContext, use } from "react";

export interface DashboardCommandPaletteContextValue {
	openCommandPalette: () => void;
}

export const DashboardCommandPaletteContext =
	createContext<DashboardCommandPaletteContextValue | null>(null);

export function useDashboardCommandPalette(): DashboardCommandPaletteContextValue {
	const context = use(DashboardCommandPaletteContext);

	if (context == null) {
		throw new Error("Missing DashboardCommandPaletteProvider.");
	}

	return context;
}
