import type { APIContext } from "astro";
import { prismaClient } from "src/global";
import {
	errorConditionerHtmlResponse,
} from "src/utils/error-conditioner";
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

	// Delete customer
	const deletedCustomer = await prismaClient.customer.delete({
		where: { id },
		select: { id: true },
	});

	const result = deletedCustomer?.id;
	if (result) {
		return redirectToAdmin();
	} else {
		return errorConditionerHtmlResponse("Customer not deleted");
	}
}
