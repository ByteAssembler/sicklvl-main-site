export function redirect(url = "/") {
	return new Response(null, {
		status: 302,
		headers: {
			Location: url,
		},
	});
}

export function redirectToAdmin() {
	return redirect("/admin");
}

export function unauthorized() {
	return new Response(null, {
		status: 401,
	});
}

export function isAdmin(user?: User | null | undefined) {
	console.log("USER", user);
	return user?.role === "admin";
}
