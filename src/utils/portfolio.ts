import { globalDB } from "./cdate";

const portfolioDB = globalDB.portfolio;

export async function portfolioMoveDownBySlug(slug: string): Promise<boolean> {
	const array = await portfolioDB.getArray();

	const current = array.find((item) => item.slug === slug);
	if (!current) return false;

	const currentIndex = array.indexOf(current);
	const nextIndex = (currentIndex + 1) % array.length;

	const next = array[nextIndex];

	array[currentIndex] = next;
	array[nextIndex] = current;

	await portfolioDB.replaceArray(array);

	return true;
}

export async function portfolioMoveUpBySlug(slug: string): Promise<boolean> {
	const array = await portfolioDB.getArray();

	const current = array.find((item) => item.slug === slug);
	if (!current) return false;

	const currentIndex = array.indexOf(current);
	const prevIndex = (currentIndex - 1 + array.length) % array.length;

	const prev = array[prevIndex];

	array[currentIndex] = prev;
	array[prevIndex] = current;

	await portfolioDB.replaceArray(array);

	return true;
}

export async function portfolioDeleteBySlug(slug: string): Promise<boolean> {
	await portfolioDB.removeIf((item) => item.slug === slug);
	return true;
}

export async function getPortfolioWithInfos(slug: string): Promise<PortfolioWithInfos | null> {
	const array = await portfolioDB.getArray();

	const current = array.find((item) => item.slug === slug);
	if (!current) return null;

	const currentIndex = array.indexOf(current);

	const prev_index = (currentIndex - 1 + array.length) % array.length;
	const next_index = (currentIndex + 1) % array.length;

	const prev = array[prev_index];
	const next = array[next_index];

	const max_portfolio_count = array.length;
	const current_portfolio_count = currentIndex + 1;

	return {
		max_portfolio_count,
		current_portfolio_count,
		prev,
		current,
		next,
	};
}
