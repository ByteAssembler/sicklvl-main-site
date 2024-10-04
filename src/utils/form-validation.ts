import { z } from "astro/zod";
import { isFileExtensionAImage, isFileExtensionAVideo } from "./file-manager";

export const checkboxBooleanOptDefFalseSchema = z
    .any()
    .optional()
    .transform((obj) => typeof obj === "string");
// .transform((obj) => obj === "on" || obj === "true" || obj !== 0 || obj === "1" || obj != null)
// .transform((obj) => !!obj)

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
    });
/*.refine((file) => file && file.length > 0, {
		message: "Files are required",
	})*/

export const multiFileSchemaImages = multiFileSchema.transform((files) => {
    if (!files) return null;
    return files.filter((f) => f && isFileExtensionAImage(f.name));
});
/*.refine((files) => files && files.length > 0, {
		message: "Files are not images",
	})*/

export const multiFileSchemaVideos = multiFileSchema
    .transform((files) => {
        if (!files) return null;
        return files.filter((f) => f && isFileExtensionAVideo(f.name));
    })
    .refine((files) => files && files.length > 0, {
        message: "Files are not videos",
    });

export const multiFileSchemaVideosOptional = multiFileSchema.transform(
    (files) => {
        if (!files) return [];
        return files.filter((f) => f && isFileExtensionAVideo(f.name));
    },
);
