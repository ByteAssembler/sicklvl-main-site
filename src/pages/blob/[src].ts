export const prerender = false;

import type { APIRoute } from "astro";
import { join } from "path";
import { createReadStream, existsSync, statSync } from "fs";

import isValidFilename from "valid-filename";
import { blobFolderPath } from "src/utils/file-manager";
import { errorConditionerHtmlResponse } from "src/utils/error-conditioner";
import { readBinaryFile } from "src/utils/filesystem-utils";

// Define the maximum chunk size as 20 MB
const MAX_CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
// Define the cacheable size as 1 MB
const CACHEABLE_SIZE = 1 * 1024 * 1024; // 1MB

interface CacheEntry {
    buffer: Uint8Array;
    size: number;
    mime: string;
}

const blobCache: { [src: string]: CacheEntry } = {};

// Function to get a file from the cache
function getFromCache(src: string): CacheEntry | null {
    return blobCache[src] ?? null;
}

// Function to check if a file is cacheable (less than 1 MB)
function isCachable(size: number): boolean {
    return size < CACHEABLE_SIZE; // 1MB
}

export const GET: APIRoute = async ({ request, params }) => {
    const { src } = params;
    if (!src || typeof src !== "string")
        return errorConditionerHtmlResponse("Not found", undefined, 404);

    // Check if the file exists
    if (!isValidFilename(src))
        return errorConditionerHtmlResponse("Invalid filename", undefined, 404);

    // Check if the file is already in the cache
    const cachedBlob = getFromCache(src);
    if (cachedBlob) {
        // Return the cached file if it exists
        return new Response(cachedBlob.buffer as BufferSource, {
            status: 200,
            headers: {
                "Content-Length": cachedBlob.size.toString(),
                // "Content-Type": "application/octet-stream",
                "Content-Disposition": `inline; filename="${src}"`,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    }

    // File path
    const filePath = join(blobFolderPath, src);

    // Check if the file exists on the disk
    if (!existsSync(filePath))
        return errorConditionerHtmlResponse("Not found", undefined, 404);

    // Get file stats
    const stat = statSync(filePath);
    const fileSize = stat.size;

    // If the file is small enough to be cached (less than 1MB), cache it
    if (isCachable(fileSize)) {
        const buffer = await readBinaryFile(filePath);
        blobCache[src] = {
            buffer,
            size: fileSize,
            mime: "application/octet-stream",
        };

        // Return the cached file response
        return new Response(buffer as BufferSource, {
            status: 200,
            headers: {
                "Content-Length": fileSize.toString(),
                // "Content-Type": "application/octet-stream",
                "Content-Disposition": `inline; filename="${src}"`,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    }

    // Handle HTTP range requests (for resumable downloads)
    const range = request.headers.get("range");

    // Utility function to convert Node.js stream to Web ReadableStream
    const streamToReadable = (stream: NodeJS.ReadableStream) => {
        return new ReadableStream({
            start(controller) {
                stream.on("data", (chunk) => {
                    if (!controller.desiredSize || controller.desiredSize > 0) {
                        controller.enqueue(chunk);
                    }
                });
                stream.on("end", () => {
                    controller.close(); // Close the stream when done
                });
                stream.on("error", (err) => {
                    controller.error(err);
                });
            },
            cancel() {
                // Clean up by destroying the Node.js stream if canceled
                (stream as any).destroy();
            },
        });
    };

    let start = 0;
    let end = Math.min(MAX_CHUNK_SIZE - 1, fileSize - 1); // Limit to max chunk size

    if (range) {
        // Parse range
        const parts = range.replace(/bytes=/, "").split("-");
        start = parseInt(parts[0], 10);
        end = parts[1]
            ? parseInt(parts[1], 10)
            : Math.min(start + MAX_CHUNK_SIZE - 1, fileSize - 1);

        // Ensure that the range doesn't exceed the maximum chunk size
        end = Math.min(end, start + MAX_CHUNK_SIZE - 1);
    }

    if (start >= fileSize) {
        return new Response(null, {
            status: 416,
            headers: {
                "Content-Range": `bytes ${fileSize}`,
            },
        });
    }

    const chunkSize = end - start + 1;
    const fileStream = createReadStream(filePath, { start, end });
    const webReadableStream = streamToReadable(fileStream);

    // Respond with partial content
    return new Response(webReadableStream, {
        status: 206,
        headers: {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize.toString(),
            "Content-Disposition": `inline; filename="${src}"`,
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    });
};
