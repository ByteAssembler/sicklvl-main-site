import { z, } from "astro/zod";

export function errorConditionerObj<A, B>(result: z.SafeParseReturnType<A, B>): null | { path: string, code: string, message: string }[] {
	if (!result.success) {
		let list = [];

		// Iterate over issues
		for (const issue of result.error.issues) {
			const path = issue.path.join(".");
			const code = issue.code;
			const message = issue.message;

			list.push({
				path,
				code,
				message,
			});
		}

		return list;
	}

	return null;
}

export function errorConditionerHtmlZod(result: z.SafeParseReturnType<any, any>, name: string): string {
	const list = errorConditionerObj(result);
	if (!list) return "";

	let table = `<table><thead><tr><th><code>Path</code></th><th><code>Code</code></th><th><code>Message</code></th></tr>`;
	for (const item of list)
		table += `<tr><td><code>${item.path}</code></td><td><code>${item.code}</code></td><td><code>${item.message}</code></td></tr>`;
	table += `</thead><tbody>`;

	return errorConditionerHtml(name, table);
}

export function errorConditionerHtmlHttpResponse(result: z.SafeParseReturnType<any, any>, name: string): Response | null {
	const errorConditionerResult = errorConditionerHtmlZod(result, name);

	if (!errorConditionerResult) return null;

	return new Response(
		errorConditionerResult,
		{
			headers: {
				"content-type": "text/html; charset=utf-8",
			},
		}
	);
}

export function errorConditionerHtml(name: string | null | undefined, htmlContent?: string): string {
	const style = `
	html, body {
		font-family: Arial, sans-serif;
		background-color: black;
		color: white;
	}
	body {
		margin: 1.5rem;
		padding: 0;
	}
	table {
		border-collapse: collapse;
		width: 100%;
	}
	th, td {
		border: 1px solid white;
		text-align: left;
		padding: 8px;
	}
	th {
		background-color: #222;
		font-weight: bolder;
	}`;

	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Document</title>
		<style>${style}</style>
	</head>
	<body>
		<h1><span style="color: red;">${name ? 'ERROR:' : 'ERROR'}</span> ${name ?? ''}</h1>
		${htmlContent ?? ''}
	</body>
	</html>
`;
}

export function errorConditionerHtmlResponse(name: string | null | undefined, htmlContent?: string): Response {
	return new Response(
		errorConditionerHtml(name, htmlContent),
		{
			headers: {
				"content-type": "text/html; charset=utf-8",
			},
		}
	);
}
