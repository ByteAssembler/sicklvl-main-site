// src/middleware.ts
import { lucia } from "./auth";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
	const sessionId =
		context.cookies.get(lucia.sessionCookieName)?.value ?? null;
	if (!sessionId) {
		context.locals.user = null;
		context.locals.session = null;
		console.log("Session ID not found");
		return next();
	}

	const { session, user } = await lucia.validateSession(sessionId);
	if (session && session.fresh) {
		const sessionCookie = lucia.createSessionCookie(session.id);
		context.cookies.set(
			sessionCookie.name,
			sessionCookie.value,
			sessionCookie.attributes
		);
		console.log("Session refreshed");
	}
	if (!session) {
		const sessionCookie = lucia.createBlankSessionCookie();
		context.cookies.set(
			sessionCookie.name,
			sessionCookie.value,
			sessionCookie.attributes
		);
		console.log("Session not found");
	}
	context.locals.session = session;
	if (context.locals.user?.attributes) {
		context.locals.user = user;
	} else {
		context.locals.user = {
			...user,
			attributes: {},
		};
	}
	console.log("Session", session);
	return next();
});
