import { keyBy } from "@acdh-oeaw/lib";

export function keyById<T extends { id: number }>(data: Array<T>): Record<number, T> {
	return keyBy(data, (d) => d.id);
}
