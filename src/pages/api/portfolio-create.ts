export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { globalDB } from "src/utils/cdate";

import { errorConditionerHtmlHttpResponse } from "src/utils/error-conditioner";
import {
	multiFileSchemaImages,
	multiFileSchemaVideos,
	saveImageWithFormatsFullHorizontal,
	saveImageWithFormatsFullVertical,
	singleFileSchemaImage,
} from "src/utils/file-manager";
import { isAdmin, redirectToAdmin, unauthorized } from "src/utils/minis";

const portfolioItemSchema = z.object({
	slug: z
		.string()
		.trim()
		.toLowerCase()
		.min(3)
		.transform((s) => s.replaceAll(" ", "-")),
	title: z.string().trim().min(3),
	description: z.string().trim(),
	content: z.string().trim().optional().default(""),

	image_vertical: singleFileSchemaImage,
	image_horizontal: singleFileSchemaImage,

	image_gallery: multiFileSchemaImages,
	video_gallery: multiFileSchemaVideos,
});

export const POST: APIRoute = async ({ request, locals }) => {
	// if (!isAdmin(locals.user)) return unauthorized();

	// Get form
	const form = await request.formData();

	// Get data
	const data = {
		slug: form.get("slug"),
		title: form.get("title"),
		description: form.get("description"),
		content: form.get("content") ?? "",

		image_vertical: form.get("image-vertical"),
		image_horizontal: form.get("image-horizontal"),

		image_gallery: form.getAll("image-gallery"),
		video_gallery: form.getAll("video-gallery"),
	};

	// Parse form data
	const result = portfolioItemSchema.safeParse(data);

	const error = errorConditionerHtmlHttpResponse(
		result,
		"Portfolio item Creation"
	);
	if (error) return error;

	if (result.success) {
		const horizontalImageFile = result.data.image_horizontal;
		const verticalImageFile = result.data.image_vertical;

		if (horizontalImageFile == null || verticalImageFile == null)
			return new Response("No image files found", {
				status: 400,
			});

		const horizontalImage = await saveImageWithFormatsFullHorizontal(
			horizontalImageFile,
			horizontalImageFile.name
		);
		const verticalImage = await saveImageWithFormatsFullVertical(
			verticalImageFile,
			verticalImageFile.name
		);

		if (horizontalImage.length === 0 || verticalImage.length === 0)
			return new Response("Failed to save image with formats", {
				status: 500,
			});

		const portfolio = await globalDB.portfolio.addToArray({
			slug: result.data.slug,
			title: result.data.title,
			description: result.data.description,
			content: result.data.content,

			image_vertical: verticalImage,
			image_horizontal: horizontalImage,

			image_gallery: [],
			video_gallery: {},
		});

		// Redirect to admin page
		return redirectToAdmin();
	}

	// Redirect to admin page
	return redirectToAdmin();
};
