import type { Metadata, ResolvingMetadata } from "next";

interface CreateMetadataParams {
	description?: string;
	title?: string;
}

export async function createMetadata(
	resolvingMetadata: ResolvingMetadata,
	params: CreateMetadataParams,
): Promise<Metadata> {
	const { description, title } = params;

	const resolvedMetadata = await resolvingMetadata;

	const metadata: Metadata = {
		...resolvedMetadata,
		title: title ?? resolvedMetadata.title,
		description: description ?? resolvedMetadata.description,
		openGraph: {
			...resolvedMetadata.openGraph,
			title: title ?? resolvedMetadata.openGraph?.title,
			description: description ?? resolvedMetadata.openGraph?.description,
		},
	} as Metadata;

	return metadata;
}
