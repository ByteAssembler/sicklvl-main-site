export const prerender = false;

import type { APIRoute } from "astro";
import { join } from "path";
import { createReadStream, existsSync, statSync } from "fs";

import isValidFilename from "valid-filename";
import { blobFolderPath } from "src/utils/file-manager";
import { errorConditionerHtmlResponse } from "src/utils/error-conditioner";
import { readBinaryFile } from "src/utils/filesystem-utils";

interface CacheEntry {
	buffer: Uint8Array;
	size: number;
	mime: string;
}

const blobCache: { [src: string]: CacheEntry; } = {};

function getFromCache(src: string): CacheEntry | null {
	return blobCache[src] ?? null;
}

function isCachable(size: number): boolean {
	return size < 1024 * 1024; // 1MB
}

export const GET: APIRoute = async ({ request, params }) => {
	const { src } = params;
	if (!src || typeof src !== "string") return errorConditionerHtmlResponse("Not found");

	// Check if the file exists
	if (!isValidFilename(src))
		return errorConditionerHtmlResponse("Invalid filename");

	const cachedBlob = getFromCache(src);
	if (cachedBlob) {
		return new Response(cachedBlob.buffer, {
			headers: {
				"Content-Length": cachedBlob.size.toString(),
				// "Content-Type": "application/octet-stream",
				"Content-Disposition": `inline; filename="${src}"`,
				"Cache-Control": "public, max-age=31536000, immutable",
			}
		});
	}

	// File path
	const filePath = join(blobFolderPath, src);

	// Check if the file exists
	if (!existsSync(filePath))
		return errorConditionerHtmlResponse("Not found");

	// Get file stats
	const stat = statSync(filePath);
	const fileSize = stat.size;

	if (isCachable(fileSize)) {
		const buffer = await readBinaryFile(filePath);
		blobCache[src] = {
			buffer,
			size: fileSize,
			mime: "application/octet-stream",
		}

		return new Response(buffer, {
			headers: {
				"Content-Length": fileSize.toString(),
				// "Content-Type": "application/octet-stream",
				"Content-Disposition": `inline; filename="${src}"`,
				"Cache-Control": "public, max-age=31536000, immutable",
			}
		});
	}

	// Handle HTTP range requests (for resumable downloads)
	const range = request.headers.get('range');

	// Utility function to convert Node.js stream to Web ReadableStream
	const streamToReadable = (stream: NodeJS.ReadableStream) => {
		return new ReadableStream({
			start(controller) {
				stream.on('data', chunk => {
					if (!controller.desiredSize || controller.desiredSize > 0) {
						controller.enqueue(chunk);
					}
				});
				stream.on('end', () => {
					controller.close(); // Close the stream when done
				});
				stream.on('error', err => {
					controller.error(err);
				});
			},
			cancel() {
				// Clean up by destroying the Node.js stream if canceled
				(stream as any).destroy();
			}
		});
	};

	if (range) {
		// Parse range
		const parts = range.replace(/bytes=/, "").split("-");
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

		if (start >= fileSize) {
			return new Response(null, {
				status: 416,
				headers: {
					'Content-Range': `bytes ${fileSize}`
				}
			});
		}

		const chunkSize = (end - start) + 1;
		const fileStream = createReadStream(filePath, { start, end });
		const webReadableStream = streamToReadable(fileStream);

		// Respond with partial content
		return new Response(webReadableStream, {
			status: 206,
			headers: {
				'Content-Range': `bytes ${start}-${end}/${fileSize}`,
				'Accept-Ranges': 'bytes',
				'Content-Length': chunkSize.toString(), // Convert number to string
				// 'Content-Type': ...,
				'Content-Disposition': `inline; filename="${src}"`,
				"Cache-Control": "public, max-age=31536000, immutable",
			}
		});
	}

	// No range request, return full file
	const fileStream = createReadStream(filePath);
	const webReadableStream = streamToReadable(fileStream);

	return new Response(webReadableStream, {
		status: 200,
		headers: {
			'Content-Length': fileSize.toString(), // Convert number to string
			// 'Content-Type': ...,
			'Content-Disposition': `inline; filename="${src}"`,
			"Cache-Control": "public, max-age=31536000, immutable",
		}
	});
};
