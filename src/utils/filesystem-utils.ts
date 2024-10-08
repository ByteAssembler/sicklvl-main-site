import {
    stat,
    mkdir,
    readdir,
    unlink,
    access,
    rename,
    copyFile,
    readFile,
} from "fs/promises";
import path from "path";

export class FileSystemError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
    ) {
        super(message);
        this.name = "FileSystemError";
    }
}

export async function createFolderIfNotExists(
    folderPath: string,
): Promise<void> {
    try {
        await stat(folderPath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            console.log(`Creating folder: ${folderPath}`);
            await mkdir(folderPath, { recursive: true });
        } else {
            throw new FileSystemError(
                `Failed to create folder: ${folderPath}`,
                (error as NodeJS.ErrnoException).code,
            );
        }
    }
}

export async function checkFileExists(filePath: string): Promise<boolean> {
    try {
        await access(filePath);
        console.log(`File "${filePath}" exists.`);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return false;
        }
        throw new FileSystemError(
            `Failed to check file existence: ${filePath}`,
            (error as NodeJS.ErrnoException).code,
        );
    }
}

export async function readFilesInFolder(folderPath: string): Promise<string[]> {
    try {
        // Create folder if it does not exist
        await createFolderIfNotExists(folderPath);

        return await readdir(folderPath);
    } catch (error) {
        throw new FileSystemError(
            `Failed to read files in folder: ${folderPath}`,
            (error as NodeJS.ErrnoException).code,
        );
    }
}

export async function readBinaryFile(filePath: string): Promise<Buffer> {
    try {
        const data = await readFile(filePath);
        return data;
    } catch (err) {
        throw new FileSystemError(
            `Failed to read binary file: ${filePath}`,
            (err as NodeJS.ErrnoException).code,
        );
    }
}

export async function deleteFileInFolder(
    folderPath: string,
    fileName: string,
): Promise<boolean> {
    const filePath = path.join(folderPath, fileName);
    try {
        await unlink(filePath);
        return true;
    } catch (error) {
        console.error(
            `Failed to delete file: ${filePath}`,
            (error as NodeJS.ErrnoException).code,
        );
        return false;
    }
}

export function getFileExtension(
    fileName: string | undefined,
): string | undefined {
    if (!fileName) return undefined;
    return path.extname(fileName).slice(1);
}

export async function moveFile(
    sourcePath: string,
    destinationPath: string,
): Promise<void> {
    try {
        await rename(sourcePath, destinationPath);
    } catch (error) {
        throw new FileSystemError(
            `Failed to move file from ${sourcePath} to ${destinationPath}`,
            (error as NodeJS.ErrnoException).code,
        );
    }
}

export async function copyFileAsync(
    sourcePath: string,
    destinationPath: string,
): Promise<void> {
    try {
        await copyFile(sourcePath, destinationPath);
    } catch (error) {
        throw new FileSystemError(
            `Failed to copy file from ${sourcePath} to ${destinationPath}`,
            (error as NodeJS.ErrnoException).code,
        );
    }
}

export async function getFileStats(
    filePath: string,
): Promise<{ size: number; modifiedTime: Date; createdTime: Date }> {
    try {
        const stats = await stat(filePath);
        return {
            size: stats.size,
            modifiedTime: stats.mtime,
            createdTime: stats.birthtime,
        };
    } catch (error) {
        throw new FileSystemError(
            `Failed to get file stats: ${filePath}`,
            (error as NodeJS.ErrnoException).code,
        );
    }
}
