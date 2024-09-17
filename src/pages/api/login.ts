// pages/api/login.ts
import { verify } from "@node-rs/argon2";

import type { APIContext } from "astro";
import { z } from "astro/zod";
import { lucia } from "src/auth";
import { globalDB } from "src/utils/cdate";

const userDB = globalDB.users;

const userLoginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6).max(255),
});

export async function POST(context: APIContext): Promise<Response> {
	const formData = await context.request.formData();

	const data = {
		email: formData.get("email"),
		password: formData.get("password"),
	};

	const result = userLoginSchema.safeParse(data);
	if (!result.success) {
		return new Response(result.error.message, {
			status: 400,
		});
	}

	const existingUser = await userDB.findOne(
		(user) => user.email === data.email
	);

	if (!existingUser) {
		// NOTE:
		// Returning immediately allows malicious actors to figure out valid usernames from response times,
		// allowing them to only focus on guessing passwords in brute-force attacks.
		// As a preventive measure, you may want to hash passwords even for invalid usernames.
		// However, valid usernames can be already be revealed with the signup page among other methods.
		// It will also be much more resource intensive.
		// Since protecting against this is non-trivial,
		// it is crucial your implementation is protected against brute-force attacks with login throttling etc.
		// If usernames are public, you may outright tell the user that the username is invalid.
		return new Response("Incorrect email or password", {
			status: 400,
		});
	}

	if (existingUser.password !== result.data.password) {
		try {
			const validPassword = await verify(
				existingUser.password,
				result.data.password,
				{
					memoryCost: 19456,
					timeCost: 2,
					outputLen: 32,
					parallelism: 1,
				}
			);
			if (!validPassword) {
				return new Response("Incorrect username or password", {
					status: 400,
				});
			}
		} catch (error) {
			console.error("Error verifying password", error);
			return new Response("Error verifying password", {
				status: 500,
			});
		}
	}

	const session = await lucia.createSession(existingUser.id, {});
	const sessionCookie = lucia.createSessionCookie(session.id);
	context.cookies.set(
		sessionCookie.name,
		sessionCookie.value,
		sessionCookie.attributes
	);

	console.log("session", session);
	console.log("session", Intl.DateTimeFormat().format(session.expiresAt));
	console.log("sessionCookie", sessionCookie);

	return context.redirect("/admin");
}
