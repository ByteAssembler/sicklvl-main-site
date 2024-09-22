import type { APIContext } from "astro";
import { lucia } from "src/global";
// import { unauthorized } from "src/utils/minis";

export async function GET(context: APIContext): Promise<Response> {
	if (!context.locals.session) {
		return context.redirect("/customer-login");
		// return unauthorized();
	}

	await lucia.invalidateSession(context.locals.session.id);

	const sessionCookie = lucia.createBlankSessionCookie();
	context.cookies.set(
		sessionCookie.name,
		sessionCookie.value,
		sessionCookie.attributes
	);

	return context.redirect("/customer-login");
}
