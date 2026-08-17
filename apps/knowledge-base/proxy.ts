import { composeMiddleware } from "@dariah-eric/next-lib/middlewares";
import type { NextProxy, ProxyConfig } from "next/server";

import { middleware as authMiddleware } from "@/lib/middlewares/auth.middleware";
import { middleware as csrfMiddleware } from "@/lib/middlewares/csrf.middleware";
import { middleware as i18nMiddleware } from "@/lib/middlewares/i18n.middleware";

export const proxy: NextProxy = composeMiddleware(csrfMiddleware, i18nMiddleware, authMiddleware);

export const config: ProxyConfig = {
	matcher: ["/", "/en/:path*", "/api/:path*"],
};
