import path, { extname } from "path";
import fs from "fs/promises";

import { checkFileExists, createFolderIfNotExists } from "./filesystem-utils";
import type { SingleImageMemory } from "src/env";

import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";

const rootFolderPath = import.meta.env.STORAGE_FOLDER_PATH || process.cwd();

export const blobFolderPath = path.join(rootFolderPath, "drive", "blob");
export const boxContentFolderPath = path.join(
    rootFolderPath,
    "drive",
    "box-content",
);

export async function saveBlob(
    data: File | FileList,
    folderPath: string,
): Promise<boolean> {
    if (data instanceof File) {
        return (await saveSingleFile(data, folderPath)) !== "";
    } else if (Array.isArray(data)) {
        let savedFiles: string[] = [];

        for (let i = 0; i < data.length; i++) {
            const file = data[i];
            if (!file) continue;

            if (file instanceof File) {
                const filePath = await saveSingleFile(file, folderPath);
                if (filePath) savedFiles.push(filePath);
                else {
                    // Revert all saved files
                    for (const filePath of savedFiles) {
                        await revertFile(filePath);
                    }
                    return false;
                }
            }
        }
    }

    return false;
}

export async function saveBlobObjectWithRevert(
    save_data: { [key: string]: any } | null,
    folderPath: string,
): Promise<boolean> {
    if (!save_data) return false;

    const savedFiles: string[] = [];

    for (const key in save_data) {
        const data = save_data[key];
        if (!data) continue;

        if (data instanceof Buffer) {
            // TODO: Check
            const filePath = path.join(folderPath, key);

            // Check if file exists
            if (await checkFileExists(filePath)) {
                console.log(`File "${key}" already exists.`);
                return false;
            }

            // Write the file buffer to the local file system using NODEJS
            try {
                await fs.writeFile(filePath, data);
            } catch (error) {
                console.error(`Error writing file "${key}": ${error}`);
                return false;
            }
        } else if (data instanceof File) {
            const filePath = await saveSingleFile(data, folderPath);
            if (filePath) savedFiles.push(filePath);
            else {
                // Revert all saved files
                for (const filePath of savedFiles) {
                    await revertFile(filePath);
                }
                return false;
            }
        } else if (Array.isArray(data)) {
            for (let i = 0; i < data.length; i++) {
                const file = data[i];
                if (!file) continue;

                if (file instanceof File) {
                    const filePath = await saveSingleFile(file, folderPath);
                    if (filePath) savedFiles.push(filePath);
                    else {
                        // Revert all saved files
                        for (const filePath of savedFiles) {
                            await revertFile(filePath);
                        }
                        return false;
                    }
                }
            }
        } else {
            console.error(`Invalid data type for "${key}"`);
            return false;
        }
    }

    return true;
}

export async function saveSingleBuffer(
    buffer: Buffer,
    name: string,
    folderPath: string,
): Promise<boolean> {
    const filePath = path.join(folderPath, name);

    // Check if file exists
    if (await checkFileExists(filePath)) {
        console.log(`File "${name}" already exists.`);
        return false;
    }

    // Write the file buffer to the local file system using NODEJS
    try {
        await fs.writeFile(filePath, buffer);
    } catch (error) {
        console.error(`Error writing file "${name}": ${error}`);
        return false;
    }

    return true;
}

export async function saveSingleFile(
    file: File,
    folderPath: string,
    fileName?: string,
): Promise<string> {
    await createFolderIfNotExists(folderPath);

    const filePath = path.join(folderPath, fileName ?? file.name);
    console.log(filePath);

    // Check if file exists
    if (await checkFileExists(filePath)) {
        console.log(`File "${file.name}" already exists.`);
        return "";
    }

    // Read the content of the file
    const valueBuffer = await file.arrayBuffer();

    // Write the file buffer to the local file system using NODEJS
    try {
        await fs.writeFile(filePath, Buffer.from(valueBuffer));
    } catch (error) {
        console.error(`Error writing file "${file.name}": ${error}`);
        return "";
    }

    return filePath;
}

export async function revertFile(filePath: string): Promise<boolean> {
    try {
        await fs.unlink(filePath);
    } catch (error) {
        console.error(`Error reverting file "${filePath}": ${error}`);
        return false;
    }
    return true;
}

export async function revertFileByFileName(
    fileName: string,
    folderPath: string,
): Promise<boolean> {
    const filePath = path.join(folderPath, fileName);
    return await revertFile(filePath);
}

// https://sharp.pixelplumbing.com/
// Create multiple images with different sizes, they should all be use as little space as possible
async function saveImageWithFormats(
    file: File,
    name: string,
    fileSizes: number[],
    fileQuality: number,
): Promise<SingleImageMemory[]> {
    // Get the file content
    const fileContent = await file.arrayBuffer();
    const fileName = name ?? file.name;

    const fileExtension = path.extname(fileName);
    const fileNameWithoutExtension = fileName.slice(
        0,
        Math.max(0, fileName.length - fileExtension.length),
    );

    // Create the images
    const image = sharp(fileContent);
    const imageWidth = (await image.metadata()).width ?? 0;

    const fileSizesToUse = fileSizes.filter((size) => size <= imageWidth);

    if (fileSizesToUse.length === 0) {
        console.error(`No valid sizes for image "${fileName}"`);
        return [];
    }

    let fileNames: SingleImageMemory[] = [];

    for (const size of fileSizesToUse) {
        const imgBuffer = await image
            .resize(size)
            .jpeg({ mozjpeg: true, quality: fileQuality })
            .toBuffer();

        const metadata = await sharp(imgBuffer).metadata();
        const width = metadata.width ?? 0;
        const height = metadata.height ?? 0;

        if (width === 0 || height === 0) {
            console.error(
                `Failed to get metadata for image "${fileName}" with size ${size}`,
            );
            return fileNames;
        }

        const newFileName = `${fileNameWithoutExtension}--${size}${fileExtension}`;
        const result = await saveSingleBuffer(
            imgBuffer,
            newFileName,
            blobFolderPath,
        );
        if (!result) {
            await revertFileByFileName(newFileName, blobFolderPath);

            // Revert all saved files
            for (const fn of fileNames) {
                await revertFileByFileName(fn.file_name, blobFolderPath);
            }

            return fileNames;
        } else {
            fileNames.push({
                file_name: newFileName,

                extension: fileExtension,
                mime: "image/jpeg",

                width: width,
                height: height,
                quality: fileQuality,

                size: imgBuffer.length,
            });
        }
    }

    return fileNames;
}

export async function saveImageWithFormatsFullHorizontal(
    file: File,
    name: string,
) {
    return await saveImageWithFormats(
        file,
        name,
        [1920, 1600, 1280, 960, 640],
        75,
    );
}

export async function saveVideo(
    file: File,
    file_video_name: string,
    folder_path: string = blobFolderPath,
): Promise<
    | {
          video_mime: string;
          video_file_name: string;
          video_file_path_full: string;
          thumbnail: SingleImageMemory;
          success: true;
      }
    | {
          success: false;
      }
> {
    const filePath = await saveSingleFile(file, folder_path, file_video_name);
    if (!filePath) return { success: false };

    const thumbnailFileExtension = extname(file_video_name);
    const thumbnailFileNameWithoutExtension = file_video_name.slice(
        0,
        Math.max(0, file_video_name.length - thumbnailFileExtension.length),
    );
    const thumbnailFileName = `${thumbnailFileNameWithoutExtension}_thumbnail.jpg`;
    const thumbnailPathNew = path.join(folder_path, thumbnailFileName);

    const proc = ffmpeg(filePath).thumbnail({
        count: 1,
        folder: folder_path,
        filename: thumbnailFileName,
        timestamps: ["1"],
        size: "1280x720",
    });

    return new Promise((resolve) => {
        proc.on("end", async () => {
            // Create a buffer from the thumbnail
            const thumbnailBuffer = await fs.readFile(thumbnailPathNew);

            // sharp
            const thumbnailSharp = sharp(thumbnailBuffer);
            const thumbnailMetadata = await thumbnailSharp.metadata();

            resolve({
                video_mime: file.type,
                video_file_name: file_video_name,
                video_file_path_full: filePath,
                thumbnail: {
                    file_name: thumbnailFileName,

                    extension: extname(thumbnailFileName),
                    mime: thumbnailMetadata.format ?? "image/jpg",

                    size: thumbnailMetadata.size ?? 0,

                    width: thumbnailMetadata.width ?? 1280,
                    height: thumbnailMetadata.height ?? 720,
                    quality: 75,
                },
                success: true,
            });
        });
        proc.on("error", (error) => {
            console.error(
                `Error creating thumbnail for video "${file_video_name}": ${error}`,
            );
            resolve({ success: false });
        });
    });
}

export function isFileExtensionAImage(fileName: string): boolean {
    const fe = path.extname(fileName).toLowerCase();
    return (
        fe === ".png" ||
        fe === ".jpg" ||
        fe === ".jpeg" ||
        fe === ".webp" ||
        fe === ".gif" ||
        fe === ".avif" ||
        fe === ".svg" ||
        fe === ".bmp"
    );
}

export function isFileExtensionAVideo(fileName: string): boolean {
    const fe = path.extname(fileName).toLowerCase();
    return (
        fe === ".mp4" ||
        fe === ".webm" ||
        fe === ".ogg" ||
        fe === ".avi" ||
        fe === ".mov" ||
        fe === ".flv" ||
        fe === ".mkv" ||
        fe === ".wmv"
    );
}

export type FileType =
    | "image"
    | "video"
    | "audio"
    | "text"
    | "application"
    | "message"
    | "model"
    | "multipart"
    | "example"
    | "font"
    | "chemical"
    | "other";

export function getFileTypeByMime(mime?: string | null): FileType {
    if (!mime) return "other";
    if (mime.startsWith("image")) return "image";
    if (mime.startsWith("video")) return "video";
    if (mime.startsWith("audio")) return "audio";
    if (mime.startsWith("text")) return "text";
    if (mime.startsWith("application")) return "application";
    if (mime.startsWith("message")) return "message";
    if (mime.startsWith("model")) return "model";
    if (mime.startsWith("multipart")) return "multipart";
    if (mime.startsWith("example")) return "example";
    if (mime.startsWith("font")) return "font";
    if (mime.startsWith("chemical")) return "chemical";
    if (mime.startsWith("audio")) return "audio";
    if (mime.startsWith("video")) return "video";
    if (mime.startsWith("image")) return "image";
    if (mime.startsWith("text")) return "text";
    if (mime.startsWith("application")) return "application";
    if (mime.startsWith("message")) return "message";
    if (mime.startsWith("model")) return "model";
    if (mime.startsWith("multipart")) return "multipart";
    if (mime.startsWith("example")) return "example";
    if (mime.startsWith("font")) return "font";
    if (mime.startsWith("chemical")) return "chemical";
    return "other";
}

export function fileNameToBoxFileUrlPath(
    fileName: string,
    download: boolean = false,
) {
    if (download)
        return `/box/file/${encodeURIComponent(fileName)}?download=true`;
    return `/box/file/${encodeURIComponent(fileName)}`;
}

export function fileNameToBlobUrlPath(fileName: string) {
    return `/blob/${encodeURIComponent(fileName)}`;
}
