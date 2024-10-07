// pages/api/login.ts
import path, { extname } from "path";
import type { APIContext } from "astro";
import { z } from "astro/zod";
import { lookup } from 'mime-types';
import fs from "fs/promises";
import { prismaClient } from "src/global";
import type { Box } from "@prisma/client";
import {
    errorConditionerHtmlHttpResponse,
    errorConditionerHtmlResponse,
} from "src/utils/error-conditioner";
import {
    checkboxBooleanOptDefFalseSchema,
} from "src/utils/form-validation";
import {
    boxContentFolderPath,
    fileManagerTempFolderPath,
    getFileTypeByMime,
    ownFileManagerFile,
} from "src/utils/file-manager";
import { redirect, redirectToAdmin, unauthorized } from "src/utils/minis";
import { checkFileExists } from "src/utils/filesystem-utils";

const boxCreateSchema = z.object({
    name: z.string().min(3).max(255),
    // files: z.array(z.string()),
    customer: z
        .array(z.string().max(255))
        .length(1)
        .transform((obj) => obj[0]),
    is_public: checkboxBooleanOptDefFalseSchema,
    password: z.string().max(255).trim().optional().default(""),
    password_for_public: checkboxBooleanOptDefFalseSchema,
    password_for_owner: checkboxBooleanOptDefFalseSchema,
});

export async function POST(context: APIContext): Promise<Response> {
    if (!context.locals.admin) return unauthorized();

    const formData = await context.request.formData();

    const data = {
        name: formData.get("name"),
        files: formData.getAll("files"),
        customer: formData.getAll("customer"),
        is_public: formData.get("is_public"),
        password: formData.get("password") || "",
        password_for_public: formData.get("password_for_public"),
        password_for_owner: formData.get("password_for_owner"),
    };

    const result = boxCreateSchema.safeParse(data);

    const error = errorConditionerHtmlHttpResponse(result, "Box Creation");
    if (error) return error;
    if (!result.success) return redirect();

    if (result.data.password_for_public) result.data.password_for_owner = true;

    let owner_id = null;
    if (result.data.customer.length !== 0) {
        // Check if customer exists
        const customer = await prismaClient.customer.findUnique({
            where: { id: result.data.customer },
            select: { id: true },
        });
        if (!customer) {
            const error = errorConditionerHtmlResponse(
                "Customer does not exist",
            );
            return error;
        }
        owner_id = customer.id;
    }

    const box = await prismaClient.box.create({
        data: {
            name: result.data.name,

            owner_id: owner_id,

            is_public: result.data.is_public,
            password: result.data.password,
            password_for_public: result.data.password_for_public,
            password_for_owner: result.data.password_for_owner,
        },
    });

    // await saveFilesInBox(box, result.data.files);

    return redirectToAdmin("box");
}

const fileNameBlacklist = [
    // Windows
    "desktop.ini",
    "thumbs.db",
    "autorun.inf",
    "ntuser.ini",
    "boot.ini",
    "bootfont.bin",
    "bootmgr",
    "bootmgr.efi",
    "iconcache.db",
    "ntldr",
    "ntuser.dat",
    "ntuser.dat.log",

    // Linux
    ".bash_history",
    ".bash_logout",
    ".bash_profile",
    ".bashrc",
    ".cache",
    ".config",
    ".local",
    ".profile",
    ".ssh",
    ".viminfo",
    ".zsh_history",
    ".zshrc",
    "authorized_keys",
    "known_hosts",
    "passwd",
    "shadow",
    "sudoers",

    // MacOS
    ".DS_Store",
    ".localized",
    ".Spotlight-V100",
    ".Trashes",
    ".fseventsd",
    ".hotfiles.btree",
    ".vol",
    ".DocumentRevisions-V100",
    ".PKInstallSandboxManager",
    ".PKInstallSandboxManager-SystemSoftware",
    ".bash_sessions",  // Additional Mac file often seen

    // Other shared files
    ".git",
    ".gitignore",
    ".htaccess",
    ".htpasswd",
    ".well-known",
];

export async function saveFilesInBox(folder: Box, fileNames: string[]) {
    if (!fileNames) return [];

    let fileIds: string[] = [];

    await fs.mkdir(fileManagerTempFolderPath, { recursive: true });

    for (const fileName of fileNames) {
        const oldFilePath = path.join(fileManagerTempFolderPath, fileName);
        const exists = await checkFileExists(oldFilePath);

        if (!exists) {
            console.error(`File does not exits: ${oldFilePath}`);
            continue;
        }

        if (fileNameBlacklist.includes(fileName.toLowerCase())) {
            console.error(`File name is blacklisted: ${oldFilePath}`);
            continue;
        }

        const mime = lookup(fileName);

        if (!mime) {
            console.error(`Failed to get mime type for file: ${oldFilePath}`);
            continue;
        }

        // Create a BoxFile record in the database
        const boxFile = await prismaClient.boxFile.create({
            data: {
                file_name: fileName,
                file_name_extension: extname(oldFilePath),
                mime: mime,
                type: getFileTypeByMime(mime),
                box_id: folder.id,
            },
        });

        fileIds.push(boxFile.id);

        const newFilePath = path.join(boxContentFolderPath, boxFile.id);

        // Save the file to the database
        const successfullyOwned = await ownFileManagerFile(
            oldFilePath,
            newFilePath,
        );
        if (!successfullyOwned) {
            console.error(`Failed to own file: ${oldFilePath} : ${newFilePath}`);

            // Delete the BoxFile record
            await prismaClient.boxFile.delete({
                where: {
                    id: boxFile.id,
                },
            });

            continue;
        }
    }

    return fileIds;
}
