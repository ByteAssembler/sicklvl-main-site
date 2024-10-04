// src/middleware.ts
import { ADMIN_COOKIE_NAME, adminSessions, lucia } from "./global";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
    const adminSessionId =
        context.cookies.get(ADMIN_COOKIE_NAME)?.value ?? null;
    if (adminSessionId) {
        const session = adminSessions.get(adminSessionId);
        if (session) {
            context.locals.admin = true;
            return next();
        }
    }

    const sessionId =
        context.cookies.get(lucia.sessionCookieName)?.value ?? null;
    if (!sessionId) {
        context.locals.customer = null;
        context.locals.session = null;
        return next();
    }

    const { session, user } = await lucia.validateSession(sessionId);
    if (session && session.fresh) {
        const sessionCookie = lucia.createSessionCookie(session.id);
        context.cookies.set(
            sessionCookie.name,
            sessionCookie.value,
            sessionCookie.attributes,
        );
    }
    if (!session) {
        const sessionCookie = lucia.createBlankSessionCookie();
        context.cookies.set(
            sessionCookie.name,
            sessionCookie.value,
            sessionCookie.attributes,
        );
    }
    context.locals.session = session;
    context.locals.customer = user;
    return next();
});
