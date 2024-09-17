// pages/api/login.ts
import { hash } from "@node-rs/argon2";

import type { APIContext } from "astro";
import { z } from "astro/zod";
import { lucia } from "src/auth";
import { globalDB } from "src/utils/cdate";
import {
	errorConditionerHtmlHttpResponse,
	errorConditionerHtmlResponse,
} from "src/utils/error-conditioner";
import {
	isAdmin,
	redirect,
	redirectToAdmin,
	unauthorized,
} from "src/utils/minis";

const userDB = globalDB.users;

const userCreateSchema = z.object({
	name: z.string().min(3).max(255),
	email: z.string().email(),
	telephone: z.string().max(25).optional().default(""),
	password: z.string().min(6).max(255),
	role: z.enum(["admin", "user"]).optional().default("user"),
	show: z
		.any()
		.optional()
		.transform((obj) => {
			return obj === "on" || obj === "true" || obj !== 0 || obj === "1";
		})
		.transform((obj) => !!obj)
		.default(false),
});

export async function POST(context: APIContext): Promise<Response> {
	// if (!isAdmin(context.locals.user)) return unauthorized();

	const formData = await context.request.formData();

	const data = {
		name: formData.get("name"),
		email: formData.get("email"),
		telephone: formData.get("telephone"),
		password: formData.get("password"),
		role: formData.get("role"),
		show: formData.get("show"),
	};

	console.log(data);

	const result = userCreateSchema.safeParse(data);

	const error = errorConditionerHtmlHttpResponse(result, "User Creation");
	if (error) return error;

	const existingUser = await userDB.findOne(
		(user) => user.email === data.email
	);

	if (!result.success) return redirect();
	if (existingUser) {
		const error = errorConditionerHtmlResponse("User already exists");
		return error;
	}

	const passwordHash = await hash(result.data.password, {
		// recommended minimum parameters
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1,
	});

	// Insert user
	const newUser = await userDB.addToArray({
		id: userDB.getNewId(),
		name: result.data.name,
		email: result.data.email,
		telephone: result.data.telephone,
		password: passwordHash,
		role: result.data.role,
		show: result.data.show,
		attributes: {},
	});

	/*
	const session = await lucia.createSession(newUser.id, {});
	const sessionCookie = lucia.createSessionCookie(session.id);
	context.cookies.set(
		sessionCookie.name,
		sessionCookie.value,
		sessionCookie.attributes
	);
	*/

	console.log(newUser);

	return redirectToAdmin();
}
