export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "astro/zod";
import type { SingleImageMemory } from "src/env";
import { prismaClient } from "src/global";

import { errorConditionerHtmlHttpResponse, errorConditionerHtmlResponse } from "src/utils/error-conditioner";
import {
	saveImageWithFormatsFullHorizontal,
	saveVideo,
} from "src/utils/file-manager";
import { multiFileSchemaImages, multiFileSchemaVideosOptional, singleFileSchemaImage } from "src/utils/form-validation";
import { redirectToAdmin, unauthorized } from "src/utils/minis";

const portfolioItemSchema = z.object({
	slug: z
		.string()
		.trim()
		.toLowerCase()
		.min(3)
		.transform((s) => s.replaceAll(/\s/g, "-")),
	title: z.string().trim().min(3),

	description: z.string().trim().optional(),
	content: z.string().trim().optional(),

	thumbnail: singleFileSchemaImage,

	image_gallery: multiFileSchemaImages.optional(),
	video_gallery: multiFileSchemaVideosOptional.optional(),
});

export const POST: APIRoute = async ({ request, locals }) => {
	if (!locals.admin) return unauthorized();

	// Get form
	const form = await request.formData();

	// Get data
	const data = {
		slug: form.get("slug"),
		title: form.get("title"),

		description: form.get("description"),
		content: form.get("content") ?? "",

		thumbnail: form.get("thumbnail"),

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
		{
			// Check if portfolio with slug already exists
			const portfolioItem = await prismaClient.portfolioItem.findUnique({
				where: {
					slug: result.data.slug,
				},
			});

			if (portfolioItem != null)
				return errorConditionerHtmlResponse("Portfolio item with slug already exists");
		}

		if (!result.data.thumbnail)
			return errorConditionerHtmlResponse("No image files found 1");

		if (!result.data.image_gallery)
			return errorConditionerHtmlResponse("No image files found 2");

		if (!result.data.video_gallery)
			return errorConditionerHtmlResponse("No video files found 3");

		const randomPrefix = Math.random().toString(36).substring(2, 9) + "-";

		const thumbnailImage = await saveImageWithFormatsFullHorizontal(
			result.data.thumbnail,
			randomPrefix + result.data.thumbnail.name
		);

		const imageGallery: SingleImageMemory[][] = [];
		for (const image of result.data.image_gallery) {
			imageGallery.push(await saveImageWithFormatsFullHorizontal(
				image,
				randomPrefix + image.name
			));
		}

		const videoGallery: ({
			video_file_name: string;
			video_file_path_full: string;
			thumbnail: SingleImageMemory,
			success: true
		})[] = [];
		for (const video of result.data.video_gallery) {
			const savedVideo = await saveVideo(video, randomPrefix + video.name);
			if (savedVideo.success) {
				videoGallery.push(savedVideo);
			}
		}

		if (thumbnailImage.length === 0)
			return errorConditionerHtmlResponse("Failed to save");

		await prismaClient.portfolioItem.create({
			data: {
				slug: result.data.slug,
				title: result.data.title,
				description: result.data.description,
				content: result.data.content,
				order: await prismaClient.portfolioItem.count(),

				thumbnail: {
					create: {
						image_variations: {
							create: thumbnailImage.map((image) => ({
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

				image_gallery: {
					create: {
						images: {
							create: imageGallery.map((images) => ({
								image_variations: {
									create: images.map((image) => ({
										file_name: image.file_name,
										extension: image.extension,
										mime: image.mime,
										size: image.size,
										width: image.width,
										height: image.height,
										quality: image.quality,
									})),
								},
							})),
						},
					}
				},

				video_gallery: {
					create: {
						videos: {
							create: videoGallery.map((video) => ({
								file_name: video.video_file_name,
								thumbnail: {
									create: {
										image_variations: {
											create: video.thumbnail
										},
									},
								},
							})),
						}
					}
				},
			},
		});

		// Redirect to admin page
		return redirectToAdmin();
	}

	// Redirect to admin page
	return redirectToAdmin();
};
