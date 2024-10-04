import archiver from "archiver";
import { existsSync } from "fs";
import { join, resolve } from "path";
import type { APIContext } from "astro";
import { BOX_PASSWORD_COOKIE_NAME, prismaClient } from "src/global";
import { AccessResult, BOXhasAccessToFolder } from "src/utils/box-utils";
import { errorConditionerHtmlResponse } from "src/utils/error-conditioner";
import { boxContentFolderPath } from "src/utils/file-manager";

export async function GET(context: APIContext): Promise<Response> {
    try {
        const { box_slug } = context.params;
        if (!box_slug || typeof box_slug !== "string") {
            return errorConditionerHtmlResponse("Invalid box identifier");
        }

        const box = await prismaClient.box.findUnique({
            where: { id: box_slug },
            include: { box_files: true },
        });

        if (!box || !box.box_files.length) {
            return errorConditionerHtmlResponse(
                "Box not found or no files available",
            );
        }

        if (
            BOXhasAccessToFolder(
                box,
                context.locals.admin,
                context.locals.customer?.id,
                context.cookies.get(BOX_PASSWORD_COOKIE_NAME)?.value,
            ) !== AccessResult.Allowed
        ) {
            return errorConditionerHtmlResponse(
                "You do not have access to this box",
            );
        }

        const files = box.box_files.map((file) => {
            const filePath = resolve(join(boxContentFolderPath, file.id));
            if (!existsSync(filePath)) {
                throw new Error(`File not found: ${file.file_name}`);
            }
            return { path: filePath, name: file.file_name };
        });

        const headers = new Headers({
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename=${box.name}_files.zip`,
        });

        return new Response(
            new ReadableStream({
                async start(controller) {
                    const archive = archiver("zip", { zlib: { level: 9 } });
                    let isCanceled = false;

                    archive.on("warning", (err) => {
                        if (err.code === "ENOENT") {
                            console.warn("File not found warning", err);
                        } else {
                            throw err;
                        }
                    });

                    archive.on("error", (err) => {
                        if (!isCanceled) {
                            controller.error(err);
                        }
                    });

                    // Check if the stream is still open before sending data
                    archive.on("data", (chunk) => {
                        if (!isCanceled) {
                            try {
                                controller.enqueue(chunk);
                            } catch (err) {
                                console.warn(
                                    "Error during enqueue, possibly due to stream being closed.",
                                    err,
                                );
                                isCanceled = true;
                                archive.abort(); // Stop archiving if stream is closed
                            }
                        }
                    });

                    // Close the controller if the archive has completed
                    archive.on("end", () => {
                        if (!isCanceled) {
                            controller.close();
                        }
                    });

                    // Add files to the archive
                    for (const file of files) {
                        archive.file(file.path, { name: file.name });
                    }

                    // Finalize the archive (this triggers streaming)
                    await archive.finalize();
                },
                cancel() {
                    console.log("Stream canceled by the client");
                    // This will signal the archiver to stop processing
                },
            }),
            { headers },
        );
    } catch (err: any) {
        console.error("Error creating ZIP file", err);
        return errorConditionerHtmlResponse(
            "An error occurred while creating the ZIP file",
        );
    }
}
