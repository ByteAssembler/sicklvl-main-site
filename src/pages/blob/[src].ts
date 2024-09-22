export const prerender = false;

import type { APIRoute } from "astro";

import { join } from "path";
import isValidFilename from "valid-filename";
import { checkFileExists, readBinaryFile } from "src/utils/filesystem-utils";
import { blobFolderPath } from "src/utils/file-manager";

interface BlobCacheEntry {
	blob: Uint8Array;
}

const blobCache: {
	[src: string]: BlobCacheEntry;
} = {};

function getFromCache(src: string): BlobCacheEntry | null {
	return blobCache[src] ?? null;
}

function blobResponse(blob: Uint8Array | Buffer, src: string) {
	return new Response(blob, {
		headers: {
			// "Content-Type": "application/octet-stream",
			"Content-Disposition": `attachment; filename="${src}"`,

			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}

export const GET: APIRoute = async ({ params }) => {
	const { src } = params;

	if (typeof src !== "string") {
		return new Response("Invalid data type for 'src'", {
			status: 400,
		});
	}

	if (!isValidFilename(src)) {
		return new Response("Invalid filename", {
			status: 400,
		});
	}

	let blob = getFromCache(src);

	if (!blob) {
		const filePath = join(blobFolderPath, src);

		// Check if file exists
		if (!(await checkFileExists(filePath))) {
			return new Response("File not found", {
				status: 404,
			});
		}

		const buffer = await readBinaryFile(filePath);

		blob = {
			blob: buffer,
		};

		blobCache[src] = blob;
	}

	if (!blob) {
		return new Response("Failed to load blob", {
			status: 500,
		});
	}

	return blobResponse(blob.blob, src);
};
