import { identity } from "@acdh-oeaw/lib";

export async function getAll<T>(
	url: URL,
	header = "X-WP-TotalPages",
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	transform: (values: any) => any = identity,
): Promise<Array<T>> {
	const results: Array<T> = [];

	const response = await fetch(url);
	const data = transform(await response.json()) as Array<T>;
	results.push(...data);

	let page = 1;
	const pages = Number(response.headers.get(header) ?? 1);

	while (++page <= pages) {
		url.searchParams.set("page", String(page));
		const response = await fetch(url);
		const data = transform(await response.json()) as Array<T>;
		results.push(...data);
	}

	return results;
}
