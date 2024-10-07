import fs from 'fs';
import path from 'path';
import { z } from 'astro/zod';
import type { APIContext } from "astro";
import { errorConditionerHtmlHttpResponse, errorConditionerHtmlResponse } from "src/utils/error-conditioner";
import { redirect, redirectToAdmin, unauthorized } from "src/utils/minis";
import isValidFilename from "valid-filename";

// Zod schema for metadata validation
const metadataSchema = z.object({
    combine: z.boolean(),
    randomPrefix: z.string().min(5),
    chunkIndex: z.number().int().nonnegative(),
    totalChunks: z.number().int().positive(),
    fileName: z.string().min(3).transform(s => isValidFilename(s) ? s : null),
    totalFileSize: z.number().positive(),
    mimeType: z.string().min(3),
});

const uploadDir = path.join(process.cwd(), 'uploads');

function getChunkPath(uploadDir: string, randomPrefix: string, fileName: string, index: number) {
    return path.join(uploadDir, `PART-${randomPrefix}-${fileName}.part${index}`);
}

async function combineChunks(uploadDir: string, fileName: string, randomPrefix: string, totalChunks: number): Promise<void> {
    const finalFilePath = path.join(uploadDir, fileName);
    const writeStream = fs.createWriteStream(finalFilePath);

    try {
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = getChunkPath(uploadDir, randomPrefix, fileName, i);
            const chunkBuffer = await fs.promises.readFile(chunkPath);

            if (chunkBuffer.length > 0) {
                writeStream.write(chunkBuffer);
            }

            // Remove the chunk after writing
            await fs.promises.unlink(chunkPath);
        }

        await new Promise<void>((resolve, reject) => {
            writeStream.end(resolve);
            writeStream.on('error', reject);
        });

        console.log(`Successfully combined all chunks into: ${finalFilePath}`);
    } catch (error) {
        console.error('Error combining file chunks:', error);
        throw error;
    }
}

export async function POST(context: APIContext): Promise<Response> {
    const { id } = context.params;
    if (!id) return errorConditionerHtmlResponse("Slug is required");

    // Extract metadata from headers
    const metadata = context.request.headers.get("x-file-metadata");
    if (!metadata) return errorConditionerHtmlResponse("Missing metadata");

    // Validate metadata using zod schema
    let parsedMetadata;
    try {
        parsedMetadata = metadataSchema.safeParse(JSON.parse(metadata));
    } catch (error) {
        return errorConditionerHtmlResponse(`Metadata validation error: ${(error as Error).message}`);
    }

    const error = errorConditionerHtmlHttpResponse(parsedMetadata, "File Upload");
    if (error) return error;
    if (!parsedMetadata.success) return redirect();

    const { combine, randomPrefix, chunkIndex, totalChunks, fileName } = parsedMetadata.data;
    if (!fileName) return errorConditionerHtmlResponse("Filename is invalid!");

    // Handle file combination if `combine` is true
    if (combine) {
        try {
            await combineChunks(uploadDir, fileName, randomPrefix, totalChunks);
            return new Response("DONE", { status: 200 });
        } catch {
            return new Response("Failed to combine file chunks", { status: 500 });
        }
    }

    // Validate chunk index
    if (chunkIndex >= totalChunks) return errorConditionerHtmlResponse("Invalid chunk index");

    // Ensure upload directory exists
    await fs.promises.mkdir(uploadDir, { recursive: true });

    // Save uploaded chunk
    const chunkBuffer = await context.request.arrayBuffer();
    const chunkPath = getChunkPath(uploadDir, randomPrefix, fileName, chunkIndex);

    try {
        await fs.promises.writeFile(chunkPath, Buffer.from(chunkBuffer));
        console.log(`Chunk ${chunkIndex} uploaded successfully`);
    } catch (error) {
        console.error("Error writing chunk:", error);
        return new Response("Failed to upload chunk", { status: 500 });
    }

    return new Response("Chunk uploaded successfully!", { status: 200 });
}
