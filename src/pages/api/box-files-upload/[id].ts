import path, { extname } from "path";
import fs from "fs/promises";
import { lookup } from "mime-types";
import type { APIContext } from "astro";
import { LargeFileUploader } from "src/utils/large-file-uploader";
import { errorConditionerHtmlResponse } from "src/utils/error-conditioner";
import { boxContentFolderPath, fileManagerFolderPath, fileManagerTempFolderPath, getFileTypeByMime } from "src/utils/file-manager";
import { prismaClient } from "src/global";
import { unauthorized } from "src/utils/minis";

const fileUploader = new LargeFileUploader(fileManagerTempFolderPath, fileManagerFolderPath, true);

export async function POST(context: APIContext): Promise<Response> {
    if (!context.locals.admin) return unauthorized();

    // Get slug parameter
    const { id } = context.params;
    if (!id || typeof id !== "string") return errorConditionerHtmlResponse("Slug is required");

    // Check if box exists
    const box = await prismaClient.box.findUnique({ where: { id } });
    if (!box) return errorConditionerHtmlResponse("Box not found");

    const uploadResult = await fileUploader.handleUpload(context);

    if (uploadResult.status === "file-combined") {
        // The file has been uploaded successfully

        const oldFilePath = uploadResult.filePath;

        const mime = lookup(uploadResult.metadata.fileName);
        if (!mime) {
            console.error(`Failed to get mime type for file: ${oldFilePath}`);
            await fs.unlink(oldFilePath); // Delete the file
            return errorConditionerHtmlResponse("Failed to get mime type for file");
        }

        // Create a BoxFile record in the database
        const boxFile = await prismaClient.boxFile.create({
            data: {
                file_name: uploadResult.metadata.fileName,
                file_name_extension: extname(oldFilePath),
                mime: mime,
                type: getFileTypeByMime(mime),
                box_id: box.id,
            },
        });

        const newFilePath = path.join(boxContentFolderPath, boxFile.id);

        // Move the file to the new location
        await fs.rename(oldFilePath, newFilePath);
    }

    return uploadResult.response;
}
