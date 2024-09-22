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

export function getImageWithPreferredWidth<T>(images: (T & {
	width: number;
})[], preferredWidth: number = 960): T { // 960x540
	let image = images.find((img) => img.width === preferredWidth);
	if (!image) {
		image = images.reduce((prev, curr) => {
			return Math.abs(curr.width - preferredWidth) < Math.abs(prev.width - preferredWidth) ? curr : prev;
		});
	}
	if (!image) image = images[0];
	if (!image) console.error("No image found for", images);

	return image;
}
