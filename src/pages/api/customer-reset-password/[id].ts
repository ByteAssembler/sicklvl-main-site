import type { APIContext } from "astro";
import { z } from "astro/zod";
import { hash } from "@node-rs/argon2";
import { prismaClient } from "src/global";
import { errorConditionerHtmlHttpResponse, errorConditionerHtmlResponse } from "src/utils/error-conditioner";
import {
	redirect,
	redirectToAdmin,
	unauthorized,
} from "src/utils/minis";

const customerResetPassword = z.object({
	password: z.string().min(6).max(255).trim(),
});

export async function POST(context: APIContext): Promise<Response> {
	if (!context.locals.admin) return unauthorized();

	// Get slug parameter
	const { id } = context.params;
	if (!id || typeof id !== "string") {
		return errorConditionerHtmlResponse("Slug is required");
	}

	const formData = await context.request.formData();

	const data = {
		password: formData.get("password"),
	};

	const result = customerResetPassword.safeParse(data);
	const error = errorConditionerHtmlHttpResponse(result, "Box Creation");
	if (error) return error;
	if (!result.success) return redirect();

	// Check if customer exists
	const customer = await prismaClient.customer.findUnique({
		where: { id },
		select: { id: true },
	});

	if (!customer) {
		return errorConditionerHtmlResponse("Customer not found");
	}

	const passwordHash = await hash(result.data.password, {
		// recommended minimum parameters
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1,
	});

	console.log(data.password, passwordHash);

	await prismaClient.customer.update({
		where: { id },
		data: {
			hashed_password: passwordHash,
		},
	});

	return redirectToAdmin("customer");
}
