import path from "path";
import type { APIContext } from "astro";
import { LargeFileUploader } from "src/utils/large-file-uploader";

const uploadDir = path.join(process.cwd(), 'uploads');
const finalDir = path.join(process.cwd(), 'final');
const fileUploader = new LargeFileUploader(uploadDir, finalDir, true);

export async function POST(context: APIContext): Promise<Response> {
    return await fileUploader.handleUpload(context);
}
