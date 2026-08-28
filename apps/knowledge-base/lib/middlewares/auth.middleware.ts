import type { Middleware } from "@dariah-eric/next-lib/middlewares";

import { sessions } from "@/config/auth.config";

/**
 * Since we can't extend set cookies insides server components, we continuously extend the cookie
 * expiration inside middleware. However, we can't detect if a new cookie was set inside server
 * actions or route handlers from middleware. This becomes an issue if we need to assign a new
 * session inside server actions (e.g. after updating the password) as the middleware cookie will
 * override it. As such, we'll only extend the cookie expiration on GET requests.
 */
export const middleware: Middleware = function middleware(request, response) {
	if (request.method.toUpperCase() !== "GET") {
		return response;
	}

	const token = request.cookies.get(sessions.cookie.name)?.value ?? null;

	if (token != null) {
		response.cookies.set(sessions.cookie.name, token, {
			...sessions.cookie.options,
			expires: new Date(Date.now() + sessions.cookie.durationMs),
		});
	}

	return response;
};
