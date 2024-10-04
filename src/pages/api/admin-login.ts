import type { APIContext } from "astro";
import { z } from "astro/zod";

import {
    ADMIN_COOKIE_NAME,
    createAdminSessionId,
    validateAdminAuthentication,
} from "src/global";
import { errorConditionerHtmlResponse } from "src/utils/error-conditioner";

const userLoginSchema = z.object({
    username: z.string().min(3).max(255),
    password: z.string().min(6).max(255),
});

export async function POST(context: APIContext): Promise<Response> {
    if (context.locals.admin) return context.redirect("/admin");

    const formData = await context.request.formData();

    const data = {
        username: formData.get("username"),
        password: formData.get("password"),
    };

    const result = userLoginSchema.safeParse(data);
    if (!result.success)
        return errorConditionerHtmlResponse("Invalid form data");

    const isAuthenticated = validateAdminAuthentication(
        result.data.username,
        result.data.password,
    );
    if (!isAuthenticated)
        return errorConditionerHtmlResponse("Invalid form data"); // This message should mislead attackers

    const sessionToken = createAdminSessionId();
    const expiresIn = 1000 * 60 * 30; // 30 minutes
    const expiresAt = new Date(Date.now() + expiresIn);

    context.cookies.set(ADMIN_COOKIE_NAME, sessionToken, {
        secure: import.meta.env.PROD,
        httpOnly: true,
        sameSite: "strict",
        expires: expiresAt,
        path: "/",
    });

    return context.redirect("/admin");
}
