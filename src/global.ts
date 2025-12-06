import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";

import pkg from '@prisma/client';
const { PrismaClient } = pkg;

export const prismaClient = new PrismaClient();
export const luciaAdapter = new PrismaAdapter(
    prismaClient.session,
    prismaClient.customer,
);
export const adminSessions = new Map<string, ADMIN_SESSION_VALUE>();

export const BOX_PASSWORD_COOKIE_NAME = "box_password";

export const ADMIN_COOKIE_NAME = "admin-session";
type ADMIN_SESSION_VALUE = {
    session_id: string;
};

export function validateAdminAuthentication(
    username: string,
    password: string,
) {
    return (
        username === "admin" &&
        password ===
            "QdvPDDZ6&qnFY8H!Rk##WeV$U@s5Pj&pLfSeEY#$BEgVC6RcHyq!&@79sn%LNCogF^p&BsKtcNNwH4QHgbg$xM%TBGe#X#$bW3hn$LqWK8My4fD6$cUFdXaQ@Q%TL*PT"
    );
}

function generateSessionId() {
    return (
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2)
    );
}

export function createAdminSessionId() {
    const id = generateSessionId();
    adminSessions.set(id, { session_id: id });
    return id;
}

export const lucia = new Lucia(luciaAdapter, {
    sessionCookie: {
        attributes: {
            secure: import.meta.env.PROD,
        },
    },
    getUserAttributes: (attributes) => {
        return {
            customerId: attributes.customerEmail,
            customerEmail: attributes.customerEmail,
        };
    },
});

declare module "lucia" {
    interface Register {
        Lucia: typeof lucia;
        DatabaseUserAttributes: DatabaseUserAttributes;
    }
}

interface DatabaseUserAttributes {
    customerId: string;
    customerEmail: string;
}
