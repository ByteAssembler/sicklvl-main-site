import fs from 'fs';
import path from 'path';
import type { APIContext } from "astro";
import { errorConditionerHtmlResponse } from "src/utils/error-conditioner";
import { redirectToAdmin, unauthorized } from "src/utils/minis";

function resp(done: boolean = false) {
    return new Response(done ? "DONE" : "Not finished", {
        status: 200
    })
}

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
            if (!(typeof totalChunks === "number" && !isNaN(totalChunks) && totalChunks > 0)) {
                console.error("Combining error... totalChunks is incorrect");
                return new Response(null, {
                    status: 400
                })
            }

            const finalFilePath = path.join(uploadDir, `${fileName}`);
            const writeStream = fs.createWriteStream(finalFilePath);
            // console.log(`Creating final file: ${finalFilePath}`);

            // Combine all chunks
            for (let i = 0; i < totalChunks; i++) {
                const chunkPath = path.join(uploadDir, `${randomPrefix}-${fileName}.part${i}`);
                // console.log(`Reading chunk: ${chunkPath}`);

                const chunkBuffer = await fs.promises.readFile(chunkPath);

                if (chunkBuffer.length === 0) {
                    // console.error(`Chunk ${i} is empty. Skipping...`);
                    continue;
                }

                // Log size of chunk being read
                // console.log(`Read chunk ${i} of size: ${chunkBuffer.length} bytes`);

                // Write the chunk into the final file
                writeStream.write(chunkBuffer, (err) => {
                    if (err) {
                        // console.error(`Error writing chunk ${i} to final file:`, err);
                        throw err;
                    }
                    // console.log(`Successfully wrote chunk ${i} to final file.`);
                });

                // Optionally delete the chunk after writing
                await fs.promises.unlink(chunkPath);
                // console.log(`Deleted chunk: ${chunkPath}`);
            }

            // Close the write stream
            await new Promise<void>((resolve, reject) => {
                writeStream.end(() => {
                    // console.log(`Finished combining all chunks into: ${finalFilePath}`);
                    resolve();
                });
                writeStream.on('error', (err) => reject(err));
            });

            return resp(true);
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
        // console.log(`Chunk ${chunkIndexParsed} uploaded successfully`);
    } catch (error) {
        console.error("Error writing chunk:", error);
        return new Response("Failed to upload chunk", { status: 500 });
    }

    return new Response("Chunk uploaded successfully!", { status: 200 });
}
