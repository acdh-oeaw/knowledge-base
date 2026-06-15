interface ItemWithEntityVersion {
	entityVersion: {
		updatedAt: Date;
		entity: { slug: string };
	};
}

export function flattenEntityVersion<T extends ItemWithEntityVersion>(
	item: T,
): Omit<T, "entityVersion"> & { entity: { slug: string }; publishedAt: string } {
	const { entityVersion, ...rest } = item;
	return {
		...rest,
		entity: entityVersion.entity,
		publishedAt: entityVersion.updatedAt.toISOString(),
	};
}
