export const prerender = false;

import type { APIRoute } from "astro";
import { errorConditionerHtmlResponse } from "src/utils/error-conditioner";

import { redirectToAdmin, unauthorized } from "src/utils/minis";
import { portfolioDeleteBySlug } from "src/utils/portfolio";

export const POST: APIRoute = async ({ params, locals }) => {
	if (!locals.admin) return unauthorized();

	// Get slug parameter
	const { slug } = params;
	if (!slug || typeof slug !== "string") {
		return errorConditionerHtmlResponse("Slug is required");
	}

	const result = await portfolioDeleteBySlug(slug);
	if (result) {
		return redirectToAdmin();
	} else {
		return errorConditionerHtmlResponse("Item not moved");
	}
};
