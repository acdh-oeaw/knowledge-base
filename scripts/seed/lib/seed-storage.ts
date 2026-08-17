import type { StorageService } from "@dariah-eric/storage";
import { stream } from "@dariah-eric/storage/lib";
import { faker as f } from "@faker-js/faker";

export interface SeedConfig {
	/** @default "2025-01-01" */
	defaultRefDate?: Date;
	/** Default 42 */
	seed?: number;
}

export interface SeedManifest {
	avatars: Array<{
		key: string;
		mimeType: string;
		label: string;
	}>;
	images: Array<{
		key: string;
		mimeType: string;
		label: string;
	}>;
}

export async function seed(client: StorageService, config: SeedConfig = {}): Promise<SeedManifest> {
	const { defaultRefDate = new Date(Date.UTC(2025, 0, 1)), seed = 42 } = config;

	f.seed(seed);
	f.setDefaultRefDate(defaultRefDate);

	const avatars = f.helpers.multiple(
		() => {
			return { url: f.image.personPortrait() };
		},
		{ count: 25 },
	);

	const images = f.helpers.multiple(
		() => {
			return {
				url: f.image.url({
					height: f.number.int({ min: 600, max: 1200 }),
					width: f.number.int({ min: 600, max: 1200 }),
				}),
			};
		},
		{ count: 25 },
	);

	const seedManifest: SeedManifest = { avatars: [], images: [] };

	for (const { url } of avatars) {
		const input = await stream.fromUrl(new URL(url));
		const [metadata, _stream] = await stream.getMetadata(input);

		const { key } = (
			await client.upload({
				input: _stream,
				metadata,
				prefix: "avatars",
				size: metadata.size,
			})
		).unwrap();

		seedManifest.avatars.push({ key, mimeType: metadata["content-type"], label: f.lorem.word() });
	}

	for (const { url } of images) {
		const input = await stream.fromUrl(new URL(url));
		const [metadata, _stream] = await stream.getMetadata(input);

		const { key } = (
			await client.upload({
				input: _stream,
				metadata,
				prefix: "images",
				size: metadata.size,
			})
		).unwrap();

		seedManifest.images.push({ key, mimeType: metadata["content-type"], label: f.lorem.word() });
	}

	return seedManifest;
}
