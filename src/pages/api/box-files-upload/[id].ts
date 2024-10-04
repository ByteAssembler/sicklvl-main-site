import type { APIContext } from "astro";
import { z } from "astro/zod";
import { prismaClient } from "src/global";
import {
    errorConditionerHtmlHttpResponse,
    errorConditionerHtmlResponse,
} from "src/utils/error-conditioner";
import { multiFileSchema } from "src/utils/form-validation";
import { redirect, redirectToAdmin, unauthorized } from "src/utils/minis";
import { saveFilesInBox } from "../box-create";

const boxFilesUploadSchema = z.object({
    files: multiFileSchema.refine((obj) => obj && obj.length > 0, {
        message: "At least one file is required",
    }),
});

export async function POST(context: APIContext): Promise<Response> {
    if (!context.locals.admin) return unauthorized();

    // Get slug parameter
    const { id } = context.params;
    if (!id || typeof id !== "string") {
        return errorConditionerHtmlResponse("Slug is required");
    }

    // Check if box exists
    const box = await prismaClient.box.findUnique({
        where: { id },
    });
    if (!box) {
        return errorConditionerHtmlResponse("Box not found");
    }

    const formData = await context.request.formData();
    const data = {
        files: formData.getAll("files"),
    };

    const result = boxFilesUploadSchema.safeParse(data);

    const error = errorConditionerHtmlHttpResponse(result, "Box Files Upload");

    if (error) return error;
    if (!result.success) return redirect();

    // Save files
    await saveFilesInBox(box, result.data.files);

    return redirectToAdmin("box");
}
