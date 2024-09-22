import type { APIContext } from "astro";
import { prismaClient } from "src/global";
import {
	errorConditionerHtmlResponse,
} from "src/utils/error-conditioner";
import { boxContentFolderPath } from "src/utils/file-manager";
import { deleteFileInFolder } from "src/utils/filesystem-utils";
import {
	redirect,
	unauthorized,
} from "src/utils/minis";

export async function POST(context: APIContext): Promise<Response> {
	if (!context.locals.admin) return unauthorized();

	// Get slug parameter
	const { id } = context.params;
	if (!id || typeof id !== "string") {
		return errorConditionerHtmlResponse("Slug is required");
	}

	// Check if box exists
	const boxFile = await prismaClient.boxFile.findUnique({
		where: { id },
		include: {
			box: {
				select: {
					id: true,
				}
			}
		}
	});
	if (!boxFile) {
		return errorConditionerHtmlResponse("File not found");
	}

	// Delete one
	const deletedBox = await prismaClient.boxFile.delete({
		where: { id },
		select: { id: true },
	});
	await deleteFileInFolder(boxContentFolderPath, deletedBox.id);

	if (boxFile.box.id.length === 1) {
		// Delete also the box
		await prismaClient.box.delete({
			where: { id },
			select: { id: true },
		});

		return redirect("/box");
	}

	return redirect(`/box/${boxFile.box_id}`);
}