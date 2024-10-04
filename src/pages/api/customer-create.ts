// pages/api/login.ts
import { hash } from "@node-rs/argon2";

import type { APIContext } from "astro";
import { z } from "astro/zod";
import { prismaClient } from "src/global";
import {
    errorConditionerHtmlHttpResponse,
    errorConditionerHtmlResponse,
} from "src/utils/error-conditioner";
import { checkboxBooleanOptDefFalseSchema } from "src/utils/form-validation";
import { redirect, redirectToAdmin, unauthorized } from "src/utils/minis";

const userCreateSchema = z.object({
    name: z.string().min(3).max(255),
    description: z.string().max(2550).optional(),
    email: z.string().email(),
    password: z.string().min(6).max(255),
    show: checkboxBooleanOptDefFalseSchema,
});

export async function POST(context: APIContext): Promise<Response> {
    if (!context.locals.admin) return unauthorized();

    const formData = await context.request.formData();

    const data = {
        name: formData.get("name"),
        description: formData.get("description") || "",
        email: formData.get("email"),
        password: formData.get("password"),
    };

    const result = userCreateSchema.safeParse(data);

    const error = errorConditionerHtmlHttpResponse(result, "Customer Creation");
    if (error) return error;
    if (!result.success) return redirect();

    const existingUser = await prismaClient.customer.findUnique({
        where: { email: result.data.email },
        select: { id: true },
    });

    if (existingUser) {
        const error = errorConditionerHtmlResponse("Customer already exists");
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
    await prismaClient.customer.create({
        data: {
            name: result.data.name,
            description: result.data.description,
            email: result.data.email,
            hashed_password: passwordHash,
            show: result.data.show,
        },
    });

    return redirectToAdmin("customer");
}
