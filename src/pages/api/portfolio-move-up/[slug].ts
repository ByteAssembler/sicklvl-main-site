export const prerender = false;

import type { APIRoute } from "astro";
import { errorConditionerHtmlResponse } from "src/utils/error-conditioner";

import { isAdmin, redirectToAdmin, unauthorized } from "src/utils/minis";
import { portfolioMoveUpBySlug } from "src/utils/portfolio";

export const POST: APIRoute = async ({ params, locals }) => {
	// if (!isAdmin(locals.user)) return unauthorized();
	// TODO: ADD AUTHENTICATION

	// Get slug parameter
	const { slug } = params;
	if (!slug || typeof slug !== "string") {
		return errorConditionerHtmlResponse("Slug is required");
	}

	const result = await portfolioMoveUpBySlug(slug);
	if (result) {
		return redirectToAdmin();
	} else {
		return errorConditionerHtmlResponse("Item not moved");
	}
};
