import type { APIContext } from "astro";
import { z } from "astro/zod";
import { prismaClient } from "src/global";
import {
    errorConditionerHtmlHttpResponse,
    errorConditionerHtmlResponse,
} from "src/utils/error-conditioner";
import {
    blobFolderPath,
    saveImageWithFormatsFullHorizontal,
} from "src/utils/file-manager";
import { createFolderIfNotExists } from "src/utils/filesystem-utils";
import { singleFileSchemaImage } from "src/utils/form-validation";
import { redirectToAdmin, unauthorized } from "src/utils/minis";

const bannerEntryCreateSchema = z.object({
    title: z.string().trim().min(3),
    image: singleFileSchemaImage,
});

export async function POST(context: APIContext): Promise<Response> {
    if (!context.locals.admin) return unauthorized();

    const formData = await context.request.formData();

    const data = {
        title: formData.get("title"),
        image: formData.get("image"),
    };

    const result = bannerEntryCreateSchema.safeParse(data);

    const error = errorConditionerHtmlHttpResponse(
        result,
        "Banner Entry Creation",
    );
    if (error) return error;
    if (!result.success) return redirectToAdmin("banner");

    // Create banner entry folder if not exists
    await createFolderIfNotExists(blobFolderPath);

    if (!result.data.image)
        return errorConditionerHtmlResponse("No image file found");

    const randomPrefix =
        "banner-" + Math.random().toString(36).substring(2, 9) + "-";

    const imageFiles = await saveImageWithFormatsFullHorizontal(
        result.data.image,
        randomPrefix + result.data.image.name,
        blobFolderPath,
    );

    if (imageFiles.length === 0)
        return errorConditionerHtmlResponse("Image could not be saved");

    // Insert user
    await prismaClient.bannerEntry.create({
        data: {
            title: result.data.title,

            file_name_prefix: randomPrefix,

            order: await prismaClient.bannerEntry.count(),

            image: {
                create: {
                    image_variations: {
                        create: imageFiles.map((image) => ({
                            file_name: image.file_name,
                            extension: image.extension,
                            mime: image.mime,
                            size: image.size,
                            width: image.width,
                            height: image.height,
                            quality: image.quality,
                        })),
                    },
                },
            },
        },
    });

    return redirectToAdmin("banner");
}
