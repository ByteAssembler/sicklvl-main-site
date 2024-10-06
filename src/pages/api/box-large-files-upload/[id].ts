import fs from 'fs';
import path from 'path';
import type { APIContext } from "astro";
import { errorConditionerHtmlResponse } from "src/utils/error-conditioner";
import { redirectToAdmin, unauthorized } from "src/utils/minis";

export async function POST(context: APIContext): Promise<Response> {
    // Get slug parameter
    const { id } = context.params;
    if (!id || typeof id !== "string") {
        return errorConditionerHtmlResponse("Slug is required");
    }

    const uploadDir = path.join(process.cwd(), 'uploads');

    // Extract metadata from headers
    const metadata = context.request.headers.get("x-file-metadata");
    if (!metadata) {
        return errorConditionerHtmlResponse("Missing metadata");
    }
    const { combine, randomPrefix, chunkIndex, totalChunks, fileName, totalFileSize, mimeType } = JSON.parse(metadata);

    // Handle file combination if the combine query is set to true
    if (typeof combine === "boolean" && combine) {
        try {
            // Combine all chunks into the final file
            await combineChunksToFile(uploadDir, randomPrefix, fileName, totalChunks);
            return redirectToAdmin("box");
        } catch (error) {
            console.error('Error combining file chunks:', error);
            return new Response("Failed to combine file chunks", { status: 500 });
        }
    }

    // Proceed with chunk upload
    const chunkIndexParsed = parseInt(chunkIndex, 10);
    const totalChunksParsed = parseInt(totalChunks, 10);

    // Validate input
    if (isNaN(chunkIndexParsed) || isNaN(totalChunksParsed) || totalChunksParsed <= 0 || isNaN(totalFileSize) || totalFileSize <= 0 || !fileName || typeof fileName !== "string" || !mimeType || typeof mimeType !== "string") {
        return errorConditionerHtmlResponse("Invalid upload parameters");
    }

    if (chunkIndexParsed >= totalChunksParsed) {
        return errorConditionerHtmlResponse("Invalid chunk index");
    }

    // Create directory for uploads if it doesn't exist
    await fs.promises.mkdir(uploadDir, { recursive: true });

    // Save the uploaded chunk
    const chunkBuffer = await context.request.arrayBuffer();
    const chunkPath = path.join(uploadDir, `${randomPrefix}-${fileName}.part${chunkIndexParsed}`);

    try {
        await fs.promises.writeFile(chunkPath, Buffer.from(chunkBuffer));
    } catch (error) {
        console.error("Error writing chunk:", error);
        return new Response("Failed to upload chunk", { status: 500 });
    }

    return new Response("Chunk uploaded successfully!", { status: 200 });
}

/**
 * Combines the uploaded chunks into a single file.
 * @param {string} uploadDir - The directory where the chunks are stored.
 * @param {string} randomPrefix - The random prefix used to identify the file.
 * @param {string} fileName - The name of the final file.
 * @param {number} totalChunks - The total number of chunks.
 * @returns {Promise<void>} - Resolves when the file is successfully combined.
 */
async function combineChunksToFile(uploadDir: string, randomPrefix: string, fileName: string, totalChunks: number): Promise<void> {
    const finalFilePath = path.join(uploadDir, fileName);

    // Ensure the final file doesn't already exist
    if (fs.existsSync(finalFilePath)) {
        await fs.promises.unlink(finalFilePath);
    }

    // Create a writable stream for the final file
    const writeStream = fs.createWriteStream(finalFilePath);

    try {
        // Loop through all chunks and append them to the final file
        for (let i = 0; i < totalChunks; i++) {
            const chunkFilePath = path.join(uploadDir, `${randomPrefix}-${fileName}.part${i}`);

            // Read the chunk file
            const chunk = await fs.promises.readFile(chunkFilePath);

            // Write the chunk to the final file
            writeStream.write(chunk);

            // Optionally, you can delete the chunk after appending it
            await fs.promises.unlink(chunkFilePath);
        }
    } catch (error) {
        console.error('Error combining chunks:', error);
        throw error;
    } finally {
        // Ensure the stream is closed after writing is done
        writeStream.end();
    }

    console.log(`Successfully combined ${totalChunks} chunks into ${finalFilePath}`);

    // Loop through all chunks and append them to the final file
    for (let i = 0; i < totalChunks; i++) {
        const chunkFilePath = path.join(uploadDir, `${randomPrefix}-${fileName}.part${i}`);
        // Optionally, you can delete the chunk after appending it
        await fs.promises.unlink(chunkFilePath);
    }
}
