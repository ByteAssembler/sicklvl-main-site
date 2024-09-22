import type { APIContext } from "astro";
import { prismaClient } from "src/global";
import {
	errorConditionerHtmlResponse,
} from "src/utils/error-conditioner";
import { boxContentFolderPath } from "src/utils/file-manager";
import { deleteFileInFolder } from "src/utils/filesystem-utils";
import {
	redirectToAdmin,
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
	const box = await prismaClient.box.findUnique({
		where: { id },
		select: { id: true },
	});
	if (!box) {
		return errorConditionerHtmlResponse("Box not found");
	}

	const deletedFilesIds = (await prismaClient.boxFile.findMany({
		where: { box_id: id },
		select: { id: true },
	}) || []).map((file) => file.id);

	for (const fileId of deletedFilesIds) {
		await deleteFileInFolder(boxContentFolderPath, fileId);
	}

	// Delete associated files
	await prismaClient.boxFile.deleteMany({
		where: { box_id: id },
	});

	// Delete
	await prismaClient.box.delete({
		where: { id },
		select: { id: true },
	});

	return redirectToAdmin("box");
}
