import fs from "fs";
import path from "path";
import { z } from "astro/zod";
import type { APIContext } from "astro";
import isValidFilename from "valid-filename";
import {
    errorConditionerHtmlHttpResponse,
    errorConditionerHtmlResponse,
} from "src/utils/error-conditioner";

// Zod schema for metadata validation
const metadataSchema = z.object({
    combine: z.boolean(),
    randomPrefix: z.string().min(5),
    chunkIndex: z.number().int().nonnegative().optional(),
    totalChunks: z.number().int().positive(),
    fileName: z
        .string()
        .min(3)
        .transform((s) => {
            while (s.includes("/") || s.includes("\\")) {
                // Remove the slashes in the front until there are none left
                // Go from left to right - leave the part on the right side

                s = s.slice(s.indexOf("/") + 1);
            }
            s = s.trim();
            return s;
        })
        .transform((s) => (isValidFilename(s) ? s : null))
        .refine((s) => s !== null, {
            message: "Invalid filename",
        })
        .refine((s) => s.length > 3),
    totalFileSize: z.number().positive(),
    mimeType: z.string().min(3),
});

export class LargeFileUploader {
    private uploadDir: string;
    private finalDir: string;

    constructor(
        uploadDir: string,
        finalDir: string,
        deleteChunkFolderFilesOnBegin: boolean,
    ) {
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
        const deletePromises = files.map((file) =>
            fs.promises
                .unlink(path.join(this.uploadDir, file))
                .catch((error) => {
                    console.error(`Error deleting file ${file}:`, error);
                }),
        );

        await Promise.all(deletePromises);
        console.log(
            `Cleared all files from the upload directory: ${this.uploadDir}`,
        );
    }

    private getChunkPath(
        randomPrefix: string,
        fileName: string,
        index: number,
    ) {
        return path.join(
            this.uploadDir,
            `PART-${randomPrefix}-${fileName}.part${index}`,
        );
    }

    private async combineChunks(
        fileName: string,
        randomPrefix: string,
        totalChunks: number,
    ): Promise<void> {
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
                writeStream.on("error", reject);
            });

            console.log(
                `Successfully combined all chunks into: ${finalFilePath}`,
            );
        } catch (error) {
            console.error("Error combining file chunks:", error);
            throw error;
        }
    }

    // New method to delete all chunks
    private async deleteAllChunks(
        randomPrefix: string,
        fileName: string,
        totalChunks: number,
    ): Promise<void> {
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

    public async handleUpload(context: APIContext): Promise<
        {
            response: Response;
        } & (
            | { status: "error"; errorMessage: string }
            | { status: "chunk-uploaded" }
            | {
                  status: "file-combined";
                  metadata: z.infer<typeof metadataSchema>;
                  filePath: string;
                  folderPath: string;
              }
        )
    > {
        // Extract metadata from headers
        const metadata = context.request.headers.get("x-file-metadata");
        if (!metadata)
            return {
                response: errorConditionerHtmlResponse("Metadata is required"),
                status: "error",
                errorMessage: "Metadata is required",
            };

        // Validate metadata using zod schema
        let parsedMetadata;
        try {
            parsedMetadata = metadataSchema.safeParse(JSON.parse(metadata));
        } catch (error) {
            return {
                response: errorConditionerHtmlResponse(
                    `Metadata validation error: ${(error as Error).message}`,
                ),
                status: "error",
                errorMessage: (error as Error).message,
            };
        }

        const error = errorConditionerHtmlHttpResponse(
            parsedMetadata,
            "File Upload",
        );
        if (error)
            return {
                response: error,
                status: "error",
                errorMessage: "Metadata is invalid",
            };
        if (!parsedMetadata.success)
            return {
                response: errorConditionerHtmlResponse("Metadata is invalid"),
                status: "error",
                errorMessage: "Metadata is invalid",
            };

        const { combine, randomPrefix, chunkIndex, totalChunks, fileName } =
            parsedMetadata.data;
        if (!fileName)
            return {
                response: errorConditionerHtmlResponse("Filename is invalid"),
                status: "error",
                errorMessage: "Filename is invalid",
            };

        // Handle file combination if `combine` is true
        if (combine) {
            try {
                await this.combineChunks(fileName, randomPrefix, totalChunks);
                return {
                    response: new Response("File combined successfully!", {
                        status: 200,
                    }),
                    status: "file-combined",
                    metadata: parsedMetadata.data,
                    filePath: path.join(this.finalDir, fileName),
                    folderPath: this.finalDir,
                };
            } catch (error) {
                // Delete all chunks if there's an error during combination
                await this.deleteAllChunks(randomPrefix, fileName, totalChunks);
                return {
                    response: new Response("Failed to combine file", {
                        status: 500,
                    }),
                    status: "error",
                    errorMessage: "Failed to combine file",
                };
            }
        }

        // Validate chunk index
        if (
            typeof chunkIndex !== "number" ||
            chunkIndex == null ||
            chunkIndex >= totalChunks
        )
            return {
                response: errorConditionerHtmlResponse("Invalid chunk index"),
                status: "error",
                errorMessage: "Invalid chunk index",
            };

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
            return {
                response: new Response("Failed to save chunk", { status: 500 }),
                status: "error",
                errorMessage: "Failed to save chunk",
            };
        }

        return {
            response: new Response("Chunk uploaded successfully", {
                status: 200,
            }),
            status: "chunk-uploaded",
        };
    }
}
