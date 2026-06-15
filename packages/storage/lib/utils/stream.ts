import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";

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

export const stream = {
	function(filePath: string): Readable {
		const stream = createReadStream(filePath);

		return stream;
	},
	async fromUrl(url: URL): Promise<Readable> {
		const result = await request(url, { responseType: "stream" });

		if (isErr(result)) {
			throw result.error;
		}

		const stream = Readable.fromWeb(result.value.data as ReadableStream);

		return stream;
	},
	async getMetadata(stream: Readable): Promise<[AssetMetadata, Readable]> {
		const _stream = stream.pipe(sharp());
		const metadata = await _stream.metadata();

		const { format, height, orientation, size, width } = metadata;

		return [
			{
				/** Used in minio web ui. */
				"content-type": `image/${format}`,
				format,
				height,
				orientation,
				size,
				width,
			},
			_stream,
		];
	},
};
