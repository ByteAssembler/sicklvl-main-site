import { existsSync, statSync, createReadStream } from "fs";
import { join } from "path";
import type { APIRoute } from "astro";
import { BOX_PASSWORD_COOKIE_NAME, prismaClient } from "src/global";
import { AccessResult, BOXhasAccessToFile } from "src/utils/box-utils";
import { errorConditionerHtmlResponse } from "src/utils/error-conditioner";
import { boxContentFolderPath } from "src/utils/file-manager";

export const GET: APIRoute = async ({
    request,
    params,
    locals,
    cookies,
    url,
}) => {
    const { slug } = params;
    if (!slug || typeof slug !== "string")
        return errorConditionerHtmlResponse("Not found");

    // Get url params
    const downloadRaw = url.searchParams.get("download");
    const download = downloadRaw === "true" || downloadRaw === "1";

    // Get box_file by slug
    const boxFile = await prismaClient.boxFile.findUnique({
        where: { id: slug },
        include: { box: true },
    });
    if (!boxFile) return errorConditionerHtmlResponse("Not found");
    if (!boxFile.mime)
        return errorConditionerHtmlResponse("Mime type not found");

    if (
        BOXhasAccessToFile(
            boxFile,
            locals.admin,
            locals.customer?.id,
            cookies.get(BOX_PASSWORD_COOKIE_NAME)?.value,
        ) !== AccessResult.Allowed
    ) {
        return errorConditionerHtmlResponse(
            "You do not have access to this box",
        );
    }

    // File path
    const filePath = join(boxContentFolderPath, boxFile.id);

    // Check if the file exists
    if (!existsSync(filePath)) {
        return new Response("File not found", { status: 404 });
    }

    // Get file stats
    const stat = statSync(filePath);
    const fileSize = stat.size;

    // Handle HTTP range requests (for resumable downloads)
    const range = request.headers.get("range");

    // Utility function to convert Node.js stream to Web ReadableStream
    const streamToReadable = (stream: NodeJS.ReadableStream) => {
        return new ReadableStream({
            start(controller) {
                stream.on("data", (chunk) => {
                    if (!controller.desiredSize || controller.desiredSize > 0) {
                        controller.enqueue(chunk);
                    }
                });
                stream.on("end", () => {
                    controller.close(); // Close the stream when done
                });
                stream.on("error", (err) => {
                    controller.error(err);
                });
            },
            cancel() {
                // Clean up by destroying the Node.js stream if canceled
                (stream as any).destroy();
            },
        });
    };

    if (range) {
        // Parse range
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize) {
            return new Response(null, {
                status: 416,
                headers: {
                    "Content-Range": `bytes */${fileSize}`,
                },
            });
        }

        const chunkSize = end - start + 1;
        const fileStream = createReadStream(filePath, { start, end });
        const webReadableStream = streamToReadable(fileStream);

        // Respond with partial content
        return new Response(webReadableStream, {
            status: 206,
            headers: {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize.toString(), // Convert number to string
                "Content-Type": boxFile.mime,
                "Content-Disposition": download
                    ? `attachment; filename="${boxFile.file_name}"`
                    : `inline; filename="${boxFile.file_name}"`,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    }

    // No range request, return full file
    const fileStream = createReadStream(filePath);
    const webReadableStream = streamToReadable(fileStream);

    return new Response(webReadableStream, {
        status: 200,
        headers: {
            "Content-Length": fileSize.toString(), // Convert number to string
            "Content-Type": boxFile.mime,
            "Content-Disposition": download
                ? `attachment; filename="${boxFile.file_name}"`
                : `inline; filename="${boxFile.file_name}"`,
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    });
};
