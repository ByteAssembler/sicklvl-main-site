import fs from 'fs';
import path from 'path';
import { z } from 'astro/zod';
import type { APIContext } from "astro";
import { errorConditionerHtmlHttpResponse, errorConditionerHtmlResponse } from "src/utils/error-conditioner";
import { redirect } from "src/utils/minis";
import isValidFilename from "valid-filename";

// Zod schema for metadata validation
const metadataSchema = z.object({
    combine: z.boolean(),
    randomPrefix: z.string().min(5),
    chunkIndex: z.number().int().nonnegative().optional(),
    totalChunks: z.number().int().positive(),
    fileName: z.string().min(3).transform(s => isValidFilename(s) ? s : null),
    totalFileSize: z.number().positive(),
    mimeType: z.string().min(3),
});

export class LargeFileUploader {
    private uploadDir: string;
    private finalDir: string;

    constructor(uploadDir: string, finalDir: string, deleteChunkFolderFilesOnBegin: boolean) {
        this.uploadDir = uploadDir;
        this.finalDir = finalDir;
        this.initDirs();
        if (deleteChunkFolderFilesOnBegin) this.clearChunkFolder(); // Clear the chunk folder on initialization
    }

    private async initDirs() {
        await fs.promises.mkdir(this.uploadDir, { recursive: true });
        await fs.promises.mkdir(this.finalDir, { recursive: true });
    }

    // New method to clear all files in the upload directory
    private async clearChunkFolder(): Promise<void> {
        const files = await fs.promises.readdir(this.uploadDir);
        const deletePromises = files.map(file =>
            fs.promises.unlink(path.join(this.uploadDir, file)).catch(error => {
                console.error(`Error deleting file ${file}:`, error);
            })
        );

        await Promise.all(deletePromises);
        console.log(`Cleared all files from the upload directory: ${this.uploadDir}`);
    }

    private getChunkPath(randomPrefix: string, fileName: string, index: number) {
        return path.join(this.uploadDir, `PART-${randomPrefix}-${fileName}.part${index}`);
    }

    private async combineChunks(fileName: string, randomPrefix: string, totalChunks: number): Promise<void> {
        const finalFilePath = path.join(this.finalDir, fileName);
        const writeStream = fs.createWriteStream(finalFilePath);

        try {
            for (let i = 0; i < totalChunks; i++) {
                const chunkPath = this.getChunkPath(randomPrefix, fileName, i);
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

    // New method to delete all chunks
    private async deleteAllChunks(randomPrefix: string, fileName: string, totalChunks: number): Promise<void> {
        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = this.getChunkPath(randomPrefix, fileName, i);
            try {
                await fs.promises.unlink(chunkPath);
                console.log(`Deleted chunk: ${chunkPath}`);
            } catch (error) {
                console.error(`Error deleting chunk ${chunkPath}:`, error);
            }
        }
    }

    public async handleUpload(context: APIContext): Promise<Response> {
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
                await this.combineChunks(fileName, randomPrefix, totalChunks);
                return new Response("DONE", { status: 200 });
            } catch (error) {
                // Delete all chunks if there's an error during combination
                await this.deleteAllChunks(randomPrefix, fileName, totalChunks);
                return new Response("Failed to combine file chunks", { status: 500 });
            }
        }

        // Validate chunk index
        if (typeof chunkIndex !== "number" || chunkIndex == null || chunkIndex >= totalChunks) return errorConditionerHtmlResponse("Invalid chunk index");

        // Save uploaded chunk
        const chunkBuffer = await context.request.arrayBuffer();
        const chunkPath = this.getChunkPath(randomPrefix, fileName, chunkIndex);

        try {
            await fs.promises.writeFile(chunkPath, Buffer.from(chunkBuffer));
            console.log(`Chunk ${chunkIndex} uploaded successfully`);
        } catch (error) {
            console.error("Error writing chunk:", error);
            // Delete all chunks if there's an error while saving the current chunk
            await this.deleteAllChunks(randomPrefix, fileName, totalChunks);
            return new Response("Failed to upload chunk", { status: 500 });
        }

        return new Response("Chunk uploaded successfully!", { status: 200 });
    }
}
