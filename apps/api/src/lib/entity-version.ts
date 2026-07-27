import { assert } from "@acdh-oeaw/lib";

interface ItemWithEntityVersion {
	entityVersion: {
		updatedAt: Date;
		slug: { value: string } | null;
	};
}

export function flattenEntityVersion<T extends ItemWithEntityVersion>(
	item: T,
): Omit<T, "entityVersion"> & { entity: { slug: string }; publishedAt: string } {
	const { entityVersion, ...rest } = item;

	assert(entityVersion.slug, "Entity version is missing its slug.");

	return {
		...rest,
		entity: { slug: entityVersion.slug.value },
		publishedAt: entityVersion.updatedAt.toISOString(),
	};
}
