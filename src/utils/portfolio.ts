import { prismaClient } from "src/global";

export async function portfolioMoveDownBySlug(slug: string): Promise<boolean> {
	const portfolio = await prismaClient.portfolioItem.findUnique({
		where: {
			slug,
		},
		select: {
			id: true,
			order: true,
		},
	});
	if (!portfolio) return false;

	const nextPortfolio = await prismaClient.portfolioItem.findFirst({
		where: {
			order: {
				gt: portfolio.order,
			},
		},
		select: {
			id: true,
			order: true,
		},
		orderBy: {
			order: "asc",
		},
	});
	if (!nextPortfolio) return false;

	await prismaClient.portfolioItem.update({
		where: {
			id: portfolio.id,
		},
		data: {
			order: nextPortfolio.order,
		},
	});

	await prismaClient.portfolioItem.update({
		where: {
			id: nextPortfolio.id,
		},
		data: {
			order: portfolio.order,
		},
	});

	return true;
}

export async function portfolioMoveUpBySlug(slug: string): Promise<boolean> {
	const portfolio = await prismaClient.portfolioItem.findUnique({
		where: {
			slug,
		},
		select: {
			id: true,
			order: true,
		},
	});
	if (!portfolio) return false;

	const previousPortfolio = await prismaClient.portfolioItem.findFirst({
		where: {
			order: {
				lt: portfolio.order,
			},
		},
		select: {
			id: true,
			order: true,
		},
		orderBy: {
			order: "desc",
		},
	});
	if (!previousPortfolio) return false;

	await prismaClient.portfolioItem.update({
		where: {
			id: portfolio.id,
		},
		data: {
			order: previousPortfolio.order,
		},
	});

	await prismaClient.portfolioItem.update({
		where: {
			id: previousPortfolio.id,
		},
		data: {
			order: portfolio.order,
		},
	});

	return true;
}

export async function portfolioDeleteBySlug(slug: string): Promise<boolean> {
	const portfolioResult = await prismaClient.portfolioItem.delete({
		where: {
			slug,
		},
	});
	return !!portfolioResult;
}

export async function getPortfolioWithInfos(slug: string) {
	const portfolio = await prismaClient.portfolioItem.findUnique({
		where: {
			slug,
		},
		select: {
			id: true,
			title: true,
			description: true,
			order: true,
			thumbnail: {
				include: {
					image_variations: true
				},
			},
			background_video: {
				include: {
					thumbnail: {
						include: {
							image_variations: true
						}
					}
				}
			},
			image_gallery: {
				include: {
					images: {
						include: {
							image_variations: true
						}
					}
				},
			},
			video_gallery: {
				include: {
					videos: {
						include: {
							thumbnail: {
								include: {
									image_variations: true
								}
							}
						}
					}
				},
			},
		}
	});
	if (!portfolio) return null;

	const max_portfolio_count = await prismaClient.portfolioItem.count();

	const [previousPortfolio, nextPortfolio] = await prismaClient.$transaction([
		prismaClient.portfolioItem.findFirst({
			where: {
				order: {
					lt: portfolio.order,
				},
			},
			orderBy: {
				order: "desc",
			},
			include: {
				thumbnail: true,
				image_gallery: true,
				video_gallery: true,
			},
		}),
		prismaClient.portfolioItem.findFirst({
			where: {
				order: {
					gt: portfolio.order,
				},
			},
			orderBy: {
				order: "asc",
			},
			include: {
				thumbnail: true,
				image_gallery: true,
				video_gallery: true,
			},
		}),
	]);

	const circularPreviousPortfolio = previousPortfolio || await prismaClient.portfolioItem.findFirst({
		orderBy: {
			order: "desc",
		},
		include: {
			thumbnail: true,
			image_gallery: true,
			video_gallery: true,
		},
	});

	const circularNextPortfolio = nextPortfolio || await prismaClient.portfolioItem.findFirst({
		orderBy: {
			order: "asc",
		},
		include: {
			thumbnail: true,
			image_gallery: true,
			video_gallery: true,
		},
	});

	if (!circularPreviousPortfolio || !circularNextPortfolio) {
		throw new Error("Portfolio count is not enough for circular navigation");
	}

	return {
		prev: circularPreviousPortfolio,
		current: portfolio,
		next: circularNextPortfolio,
		current_portfolio_count: portfolio.order,
		max_portfolio_count,
	};
}