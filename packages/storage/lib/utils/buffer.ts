import * as fs from "node:fs/promises";

import { isErr, request } from "@acdh-oeaw/lib";
import sharp from "sharp";

interface AssetMetadata {
	"content-type": string;
	format: string;
	height: number;
	orientation: number | undefined;
	size: number | undefined;
	width: number;
}

export const buffer = {
	async fromFilePath(filePath: string): Promise<Buffer> {
		const buffer = await fs.readFile(filePath);

		return buffer;
	},
	async fromUrl(url: URL): Promise<Buffer> {
		const result = await request(url, { responseType: "arrayBuffer" });

		if (isErr(result)) {
			throw result.error;
		}

		const buffer = Buffer.from(result.value.data);

		return buffer;
	},
	async getMetadata(buffer: Buffer): Promise<AssetMetadata> {
		const metadata = await sharp(buffer).metadata();

		const { format, height, orientation, size, width } = metadata;

		return {
			/** Used in minio web ui. */
			"content-type": `image/${format}`,
			format,
			height,
			orientation,
			size,
			width,
		};
	},
};
