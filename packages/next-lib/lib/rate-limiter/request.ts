import { RefillingTokenBucket } from "@dariah-eric/rate-limiter";
import { headers } from "next/headers";

export const globalBucket = new RefillingTokenBucket<string>(100, 1);

/**
 * Loopback addresses are local/trusted connections (e.g. from the same machine or a local reverse
 * proxy). Rate-limiting them provides no security benefit and would break parallel e2e test workers
 * that all originate from 127.0.0.1 / ::1.
 */
function isLoopback(ip: string): boolean {
	return ip === "127.0.0.1" || ip === "::1" || ip.startsWith("::ffff:127.");
}

export async function globalGetRequestRateLimit(): Promise<boolean> {
	const list = await headers();
	const ip = list.get("x-forwarded-for");

	if (ip == null || isLoopback(ip)) {
		return true;
	}

	return globalBucket.consume(ip, 1);
}

export async function globalPostRequestRateLimit(): Promise<boolean> {
	const list = await headers();
	const ip = list.get("x-forwarded-for");

	if (ip == null || isLoopback(ip)) {
		return true;
	}

	return globalBucket.consume(ip, 3);
}
