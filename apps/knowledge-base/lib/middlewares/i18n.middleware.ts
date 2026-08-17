import { includes, removeTrailingSlash } from "@acdh-oeaw/lib";
import type { Middleware } from "@dariah-eric/next-lib/middlewares";
import createI18nMiddleware from "next-intl/middleware";

import { localePrefix, routing } from "@/lib/i18n/routing";

const intlMiddleware = createI18nMiddleware(routing);

export const middleware: Middleware = function middleware(request, response) {
	if (!request.nextUrl.pathname.startsWith("/api")) {
		const response = intlMiddleware(request);

		if (request.method.toUpperCase() !== "GET") {
			return response;
		}

		/**
		 * 'next-intl` v4 adds an `x-default` alternate link for all routes, which we don't want, since
		 * we only redirect on "/".
		 *
		 * @see {@link https://next-intl.dev/docs/routing/configuration#alternate-links}
		 */

		const pathname = removeTrailingSlash(request.nextUrl.pathname);

		if (!includes(Object.values(localePrefix.prefixes), pathname)) {
			const header = response.headers.get("link");

			if (header != null) {
				const links = header
					.split(",")
					.filter(
						(link) => !(link.includes('rel="alternate"') && link.includes('hreflang="x-default"')),
					);

				response.headers.set("link", links.join(","));
			}
		}

		return response;
	}

	return response;
};
