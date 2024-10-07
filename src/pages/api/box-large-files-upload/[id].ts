import path from "path";
import type { APIContext } from "astro";
import { LargeFileUploader } from "src/utils/large-file-uploader";
import { errorConditionerHtmlResponse } from "src/utils/error-conditioner";

const uploadDir = path.join(process.cwd(), 'uploads');
const finalDir = path.join(process.cwd(), 'final');
const fileUploader = new LargeFileUploader(uploadDir, finalDir, true);

export async function POST(context: APIContext): Promise<Response> {
    const { id } = context.params;
    if (!id) return errorConditionerHtmlResponse("Slug is required");

    return await fileUploader.handleUpload(context);
}
