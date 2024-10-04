export function redirect(url = "/") {
    return new Response(null, {
        status: 302,
        headers: {
            Location: url,
        },
    });
}

export function redirectToAdmin(pos: "root" | "customer" | "box" = "root") {
    if (pos === "customer") return redirect("/admin/customer");
    if (pos === "box") return redirect("/admin/box");
    return redirect("/admin");
}

export function redirectCustomerLogin() {
    return redirect("/customer-login");
}

export function redirectAdminLogin() {
    return redirect("/admin/login");
}

export function unauthorized() {
    return new Response(null, {
        status: 401,
    });
}

export function getImageWithPreferredWidth<T>(
    images: (T & {
        width: number;
    })[],
    preferredWidth: number = 960,
): T | null {
    // 960x540
    if (images.length === 0) return null;

    return images.reduce((closestImage, currentImage) => {
        const currentDifference = Math.abs(currentImage.width - preferredWidth);
        const closestDifference = Math.abs(closestImage.width - preferredWidth);

        return currentDifference < closestDifference
            ? currentImage
            : closestImage;
    });
}
