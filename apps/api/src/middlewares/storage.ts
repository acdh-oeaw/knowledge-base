import type { StorageService } from "@dariah-eric/storage";

import { createMiddleware } from "@/lib/factory";
import { storage as client } from "@/services/storage";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function storage(service: StorageService = client) {
	return createMiddleware(async (c, next) => {
		c.set("storage", service);
		await next();
	});
}
