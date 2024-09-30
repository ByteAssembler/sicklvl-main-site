export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { extname } from "path";
import type { SingleImageMemory } from "src/env";
import { prismaClient } from "src/global";

import { errorConditionerHtmlHttpResponse, errorConditionerHtmlResponse } from "src/utils/error-conditioner";
import {
	blobFolderPath,
	saveImageWithFormatsFullHorizontal,
	saveVideo,
} from "src/utils/file-manager";
import { createFolderIfNotExists } from "src/utils/filesystem-utils";
import { multiFileSchemaImages, multiFileSchemaVideosOptional, singleFileSchemaImage, singleFileSchemaVideo } from "src/utils/form-validation";
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
	background_video: singleFileSchemaVideo,

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
		background_video: form.get("background-video"),

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
		// Create blob folder if not exists
		await createFolderIfNotExists(blobFolderPath);

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

		if (!result.data.background_video)
			return errorConditionerHtmlResponse("No image files found 2");

		if (!result.data.image_gallery)
			return errorConditionerHtmlResponse("No image files found 3");

		if (!result.data.video_gallery)
			return errorConditionerHtmlResponse("No video files found 4");

		function randomString() {
			return Math.random().toString(36).substring(2, 9) + "-";
		}

		const randomPrefix = randomString();

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
			video_mime: string;
			video_file_name: string;
			video_file_path_full: string;
			thumbnail: SingleImageMemory,
			success: true
		})[] = [];
		for (const video of result.data.video_gallery) {
			const savedVideo = await saveVideo(video, randomPrefix + video.name);
			if (savedVideo.success) {
				videoGallery.push(savedVideo);
			} else {
				return errorConditionerHtmlResponse("Failed to save a video");
			}
		}

		const backgroundVideo = await saveVideo(
			result.data.background_video,
			randomPrefix + result.data.background_video.name
		);

		if (!backgroundVideo.success)
			return errorConditionerHtmlResponse("Failed to save background video");

		if (thumbnailImage.length === 0)
			return errorConditionerHtmlResponse("Failed to save");

		await prismaClient.portfolioItem.create({
			data: {
				slug: result.data.slug,
				title: result.data.title,
				description: result.data.description,
				content: result.data.content,
				order: await prismaClient.portfolioItem.count(),
				file_name_prefix: randomPrefix,

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

				background_video: {
					create: {
						file_name: backgroundVideo.video_file_name,
						extension: extname(backgroundVideo.video_file_name),
						mime: backgroundVideo.video_mime,
						width: backgroundVideo.thumbnail.width, // TODO Add width from video
						height: backgroundVideo.thumbnail.height, // TODO Add height from video
						thumbnail: {
							create: {
								image_variations: {
									create: backgroundVideo.thumbnail
								},
							},
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
								extension: extname(video.video_file_name),
								mime: video.video_mime,
								width: video.thumbnail.width, // TODO Add width from video
								height: video.thumbnail.height, // TODO Add height from video
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
