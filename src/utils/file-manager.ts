import path from "path";
import fs from "fs/promises";

import { z } from "astro/zod";

import { checkFileExists, createFolderIfNotExists } from "./filesystem-utils";

export const blobFolderPath = path.join(process.cwd(), "drive", "blob");

export const singleFileSchema = z
	.custom<FileList | null>()
	.transform((file) => {
		if (!file) return null;
		if (file instanceof File) return file;
		return file.length > 0 ? file.item(0) : null;
	})
	.transform((file) => {
		if (!file) return null;
		return file.size > 1 ? file : null;
	})
	.refine((file) => file, {
		message: "File is required",
	});

export const singleFileSchemaImage = singleFileSchema
	.transform((file) => {
		if (!file) return null;
		return isFileExtensionAImage(file.name) ? file : null;
	})
	.refine((file) => file, {
		message: "File is not an image",
	});

export const singleFileSchemaVideo = singleFileSchema
	.transform((file) => {
		if (!file) return null;
		return isFileExtensionAVideo(file.name) ? file : null;
	})
	.refine((file) => file, {
		message: "File is not a video",
	});

export const multiFileSchema = z
	.custom<FileList | null>()
	.transform((file) => {
		if (!file) return null;
		if (file instanceof File) return [file];
		if (Array.isArray(file)) return file.filter((f) => f instanceof File);
		const files: File[] = [];
		for (let i = 0; i < file.length; i++) {
			const f = file.item(i);
			if (f instanceof File) files.push(f);
		}
		return files;
	})
	.transform((files) => {
		if (!files) return null;
		return files.length > 0 ? files.filter((f) => f.size > 1) : null;
	})
	.transform((files) => {
		if (!files) return null;
		return files.filter((f) => f && f.size > 1);
	})
	.refine((file) => file && file.length > 0, {
		message: "Files are required",
	});

export const multiFileSchemaImages = multiFileSchema
	.transform((files) => {
		if (!files) return null;
		return files.filter((f) => f && isFileExtensionAImage(f.name));
	})
	.refine((files) => files && files.length > 0, {
		message: "Files are not images",
	});

export const multiFileSchemaVideos = multiFileSchema
	.transform((files) => {
		if (!files) return null;
		return files.filter((f) => f && isFileExtensionAVideo(f.name));
	})
	.refine((files) => files && files.length > 0, {
		message: "Files are not videos",
	});

export async function saveBlob(data: File | FileList): Promise<boolean> {
	if (data instanceof File) {
		return (await saveSingleFile(data)) !== "";
	} else if (Array.isArray(data)) {
		let savedFiles: string[] = [];

		for (let i = 0; i < data.length; i++) {
			const file = data[i];
			if (!file) continue;

			if (file instanceof File) {
				const filePath = await saveSingleFile(file);
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
	save_data?: { [key: string]: any } | null
): Promise<boolean> {
	if (!save_data) return false;

	const savedFiles: string[] = [];

	for (const key in save_data) {
		const data = save_data[key];
		if (!data) continue;

		if (data instanceof Buffer) {
			// TODO: Check
			const filePath = path.join(blobFolderPath, key);

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
			const filePath = await saveSingleFile(data);
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
					const filePath = await saveSingleFile(file);
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
	name: string
): Promise<boolean> {
	const filePath = path.join(blobFolderPath, name);

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

export async function saveSingleFile(file: File): Promise<string> {
	await createFolderIfNotExists(blobFolderPath);

	const filePath = path.join(blobFolderPath, file.name);

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

export async function revertFileByFileName(fileName: string): Promise<boolean> {
	const filePath = path.join(blobFolderPath, fileName);
	return await revertFile(filePath);
}

// https://sharp.pixelplumbing.com/
// Create multiple images with different sizes, they should all be use as little space as possible
// Sizes: XXx1080, XXx720, XXx480, XXx120

export async function saveImageWithFormats(
	file: File,
	name: string,
	fileSizes: number[],
	fileQuality: number
): Promise<CImage[]> {
	const { default: sharp } = await import("sharp");

	// Get the file content
	const fileContent = await file.arrayBuffer();
	const fileName = name ?? file.name;

	const fileExtension = path.extname(fileName);
	const fileNameWithoutExtension = fileName.slice(
		0,
		Math.max(0, fileName.length - fileExtension.length)
	);

	// Create the images
	const image = sharp(fileContent);

	let fileNames: CImage[] = [];

	for (const size of fileSizes) {
		const imgBuffer = await image
			.resize(size)
			.jpeg({ mozjpeg: true, quality: fileQuality })
			.toBuffer();

		const metadata = await sharp(imgBuffer).metadata();
		const width = metadata.width ?? 0;
		const height = metadata.height ?? 0;

		if (width === 0 || height === 0) {
			console.error(
				`Failed to get metadata for image "${fileName}" with size ${size}`
			);
			return fileNames;
		}

		const newFileName = `${fileNameWithoutExtension}--${size}${fileExtension}`;
		const result = await saveSingleBuffer(imgBuffer, newFileName);
		if (!result) {
			await revertFileByFileName(newFileName);

			// Revert all saved files
			for (const fn of fileNames) {
				await revertFileByFileName(fn.file_name);
			}

			return fileNames;
		} else {
			fileNames.push({
				file_name: newFileName,
				width: width,
				height: height,

				mime: "image/jpeg",
				extension: fileExtension,
				size: imgBuffer.length,
				quality: fileQuality,
			});
		}
	}

	return fileNames;
}

export async function saveImageWithFormatsFullHorizontal(
	file: File,
	name: string
): Promise<CImage[]> {
	return await saveImageWithFormats(
		file,
		name,
		[1920, 1080, 720, 480, 120],
		75
	);
}

export async function saveImageWithFormatsFullVertical(
	file: File,
	name: string
): Promise<CImage[]> {
	return await saveImageWithFormats(file, name, [1080, 720, 480, 120], 75);
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

export function fileNameToBlobUrlPath(fileName: string) {
	return `/blob/${fileName}`;
}
