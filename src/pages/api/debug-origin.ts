import type { APIContext } from "astro";

// TEMPORÄRER DEBUG-ENDPOINT - nach dem Fix löschen!
export async function GET(context: APIContext): Promise<Response> {
    const req = context.request;
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
        headers[key] = value;
    });

    const info = {
        url: req.url,
        urlOrigin: new URL(req.url).origin,
        originHeader: req.headers.get("origin"),
        hostHeader: req.headers.get("host"),
        xForwardedProto: req.headers.get("x-forwarded-proto"),
        xForwardedHost: req.headers.get("x-forwarded-host"),
        xForwardedFor: req.headers.get("x-forwarded-for"),
        method: req.method,
        allHeaders: headers,
    };

    return new Response(JSON.stringify(info, null, 2), {
        headers: { "content-type": "application/json" },
    });
}
