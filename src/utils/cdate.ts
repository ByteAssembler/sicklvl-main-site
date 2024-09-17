import path from "path";
import { checkFileExists, FileSystemError } from "./filesystem-utils";
import { mkdir, readFile, writeFile } from "fs/promises";
import { randomUUID } from "crypto";

export const databaseFolderPath = path.join(process.cwd(), "drive", "database");

class CustomFileObjectDatabase<T> {
	private lastAccessedDateTime: Date;
	public cacheContent: T | undefined;
	public readonly path: string;

	constructor(
		public name: string,
		fileName: string,
		private cacheTimeMS: number = 1000 * 60 * 60
	) {
		this.path = path.join(databaseFolderPath, fileName);
		this.lastAccessedDateTime = new Date(0);
		this.cacheContent = undefined;
	}

	public async init(defaultData: T): Promise<void> {
		// Create base folder if it doesn't exist
		try {
			await mkdir(databaseFolderPath, { recursive: true });
		} catch (error) {
			console.error(error);
			throw new FileSystemError(
				`Failed to create database folder: ${databaseFolderPath}`,
				(error as NodeJS.ErrnoException).code
			);
		}

		const fileExists = await this.checkIfFileExists();
		if (!fileExists) {
			await this.writeToFile(defaultData);
			this.log(`Creating file: ${this.path}`);
		} else {
			this.log(`File already exists: ${this.path}`);
		}

		this.cacheContent = await this.readFromFile();
	}

	private async checkIfFileExists(): Promise<boolean> {
		return checkFileExists(this.path);
	}

	async writeToFile(contentData: T): Promise<void> {
		try {
			const jsonStr = JSON.stringify(contentData, null, 2);
			await writeFile(this.path, jsonStr, {
				encoding: "utf8",
				flag: "w+",
			});

			this.cacheContent = contentData;
			this.lastAccessedDateTime = new Date();

			this.log(`Writing to file: ${this.path}`);
		} catch (error) {
			console.error(error);
			throw new FileSystemError(
				`Failed to write to file: ${this.path}`,
				(error as NodeJS.ErrnoException).code
			);
		}
	}

	async readFromFile(): Promise<T> {
		const accessedRecently = checkIfDateIsNotOlderThan(
			this.lastAccessedDateTime,
			this.cacheTimeMS
		);

		if (accessedRecently) {
			this.log(`Reading from cache: ${this.path}`);
			if (!this.cacheContent) throw new FileSystemError("Cache is empty");
			return this.cacheContent;
		} else {
			try {
				const fileContent = await readFile(this.path, {
					encoding: "utf8",
				});

				this.cacheContent = JSON.parse(fileContent) as T;
				this.lastAccessedDateTime = new Date();

				this.log(`Read from file: ${this.path}`);

				return this.cacheContent;
			} catch (error) {
				throw new FileSystemError(
					`Failed to read from file: ${this.path}`,
					(error as NodeJS.ErrnoException).code
				);
			}
		}
	}

	async updateFile(updateFn: (data: T) => T): Promise<void> {
		const currentData = await this.readFromFile();
		const updatedData = updateFn(currentData);
		await this.writeToFile(updatedData);
	}

	async updateFileAsync(updateFn: (data: T) => Promise<T>): Promise<void> {
		const currentData = await this.readFromFile();
		const updatedData = await updateFn(currentData);
		await this.writeToFile(updatedData);
	}

	log(msg: string): void {
		console.log(`${this.name} | ${msg}`);
	}

	async clearCache(): Promise<void> {
		this.cacheContent = undefined;
		this.lastAccessedDateTime = new Date(0);
	}
}

class CustomFileArrayDatabase<
	T extends { id: string },
	I
> extends CustomFileObjectDatabase<T[]> {
	constructor(
		public name: string,
		fileName: string,
		cacheTimeMS: number = 1000 * 60 * 60,
		public convertToItem: (toInsert: I) => T
	) {
		super(name, fileName, cacheTimeMS);
	}

	public async updateFile(updateFn: (data: T[]) => T[]): Promise<void> {
		const currentData = await this.readFromFile();
		const updatedData = updateFn(currentData);
		await this.writeToFile(updatedData);
	}

	async updateFileAsync(
		updateFn: (data: T[]) => Promise<T[]>
	): Promise<void> {
		const currentData = await this.readFromFile();
		const updatedData = await updateFn(currentData);
		await this.writeToFile(updatedData);
	}

	async addToArray(item: I): Promise<T> {
		const newItem = this.convertToItem(item);
		newItem.id = this.getNewId();
		await this.updateFileAsync(async (data) => {
			data.push(newItem);
			return data;
		});
		return newItem;
	}

	async removeFromArray(item: T): Promise<void> {
		await this.updateFile((data) => {
			const index = data.indexOf(item);
			if (index !== -1) data.splice(index, 1);
			return data;
		});
	}

	async reduceArray(reducerFn: (data: T[]) => T[]): Promise<void> {
		await this.updateFile(reducerFn);
	}

	async reduceArrayAsync(
		reducerFn: (data: T[]) => Promise<T[]>
	): Promise<void> {
		await this.updateFileAsync(reducerFn);
	}

	async removeIf(predicateFn: (item: T) => boolean): Promise<void> {
		await this.updateFile((data) => {
			return data.filter((item) => !predicateFn(item));
		});
	}

	async removeIfAsync(
		predicateFn: (item: T) => Promise<boolean>
	): Promise<void> {
		await this.updateFileAsync(async (data) => {
			return data.filter(async (item) => !(await predicateFn(item)));
		});
	}

	async sortArray(sortFn: (a: T, b: T) => number): Promise<void> {
		await this.updateFile((data) => {
			return data.sort(sortFn);
		});
	}

	async findOne(predicateFn: (item: T) => boolean): Promise<T | undefined> {
		const data = await this.readFromFile();
		return data.find(predicateFn);
	}

	async findOneAsync(
		predicateFn: (item: T) => Promise<boolean>
	): Promise<T | undefined> {
		const data = await this.readFromFile();
		for (const item of data) {
			if (await predicateFn(item)) return item;
		}
	}

	async findMany(predicateFn: (item: T) => boolean): Promise<T[]> {
		const data = await this.readFromFile();
		return data.filter(predicateFn);
	}

	async findManyAsync(
		predicateFn: (item: T) => Promise<boolean>
	): Promise<T[]> {
		const data = await this.readFromFile();
		const result: T[] = [];
		for (const item of data) {
			if (await predicateFn(item)) result.push(item);
		}
		return result;
	}

	async findManyWithLimit(
		predicateFn: (item: T) => boolean,
		limit: number
	): Promise<T[]> {
		const data = await this.readFromFile();
		const result: T[] = [];
		for (const item of data) {
			if (predicateFn(item)) {
				result.push(item);
				if (result.length >= limit) break;
			}
		}
		return result;
	}

	async findManyWithLimitAsync(
		predicateFn: (item: T) => Promise<boolean>,
		limit: number
	): Promise<T[]> {
		const data = await this.readFromFile();
		const result: T[] = [];
		for (const item of data) {
			if (await predicateFn(item)) {
				result.push(item);
				if (result.length >= limit) break;
			}
		}
		return result;
	}

	async findOneAndUpdate(
		predicateFn: (item: T) => boolean,
		updateFn: (item: T) => T
	): Promise<void> {
		await this.updateFile((data) => {
			for (let i = 0; i < data.length; i++) {
				if (predicateFn(data[i])) {
					data[i] = updateFn(data[i]);
					break;
				}
			}
			return data;
		});
	}

	async findOneAndUpdateAsync(
		predicateFn: (item: T) => Promise<boolean>,
		updateFn: (item: T) => Promise<T>
	): Promise<void> {
		await this.updateFileAsync(async (data) => {
			for (let i = 0; i < data.length; i++) {
				if (await predicateFn(data[i])) {
					data[i] = await updateFn(data[i]);
					break;
				}
			}
			return data;
		});
	}

	async findManyAndUpdate(
		predicateFn: (item: T) => boolean,
		updateFn: (item: T) => T
	): Promise<void> {
		await this.updateFile((data) => {
			for (let i = 0; i < data.length; i++) {
				if (predicateFn(data[i])) {
					data[i] = updateFn(data[i]);
				}
			}
			return data;
		});
	}

	async findManyAndUpdateAsync(
		predicateFn: (item: T) => Promise<boolean>,
		updateFn: (item: T) => Promise<T>
	): Promise<void> {
		await this.updateFileAsync(async (data) => {
			for (let i = 0; i < data.length; i++) {
				if (await predicateFn(data[i])) {
					data[i] = await updateFn(data[i]);
				}
			}
			return data;
		});
	}

	async deleteMany(predicateFn: (item: T) => boolean): Promise<void> {
		await this.updateFile((data) => {
			return data.filter((item) => !predicateFn(item));
		});
	}

	async deleteOne(predicateFn: (item: T) => boolean): Promise<void> {
		await this.updateFile((data) => {
			const index = data.findIndex(predicateFn);
			if (index !== -1) data.splice(index, 1);
			return data;
		});
	}

	async updateOne(
		predicateFn: (item: T) => boolean,
		updateFn: (item: T) => T
	): Promise<void> {
		await this.updateFile((data) => {
			for (let i = 0; i < data.length; i++) {
				if (predicateFn(data[i])) {
					data[i] = updateFn(data[i]);
					break;
				}
			}
			return data;
		});
	}

	async replaceArray(newData: T[]): Promise<void> {
		await this.writeToFile(newData);
	}

	async clearArray(): Promise<void> {
		await this.writeToFile([]);
	}

	async getArray(): Promise<T[]> {
		return await this.readFromFile();
	}

	async getArrayItem(index: number): Promise<T> {
		const data = await this.readFromFile();
		return data[index];
	}

	async doesArrayContain(item: T): Promise<boolean> {
		const data = await this.readFromFile();
		return data.includes(item);
	}

	getNewId(): string {
		// Generate a new UUID without dashes
		return randomUUID().replace(/-/g, "");
	}
}

interface GlobalDatabase {
	portfolio: CustomFileArrayDatabase<PortfolioItem, PortfolioItemCreateBase>;
	users: CustomFileArrayDatabase<User, User>;
	sessions: CustomFileArrayDatabase<UserSession, UserSession>;
}

export const globalDB: GlobalDatabase = {
	portfolio: await createCustomStorageArrayDatabase(
		"portfolio",
		"portfolio.json",
		(toInsert) => Object.assign(toInsert, { id: globalDB.portfolio.getNewId() })
	),
	users: await createCustomStorageArrayDatabase(
		"users",
		"users.json",
		(toInsert) => toInsert
	),
	sessions: await createCustomStorageArrayDatabase(
		"sessions",
		"sessions.json",
		(toInsert) => toInsert
	),
};

(async () => {
	// Check if the database is empty
	const userArray = await globalDB.users.getArray();
	if (userArray.length === 0) {
		const adminUser = await globalDB.users.addToArray({
			id: globalDB.users.getNewId(),
			name: "admin",
			email: "admin@sicklevel.com",
			telephone: "",
			password: "QdvPDDZ6&qnFY8H!Rk##WeV$U@s5Pj&pLfSeEY#$BEgVC6RcHyq!&@79sn%LNCogF^p&BsKtcNNwH4QHgbg$xM%TBGe#X#$bW3hn$LqWK8My4fD6$cUFdXaQ@Q%TL*PT",
			role: "admin",
			show: false,
			attributes: {}
		});
		console.log(adminUser);
	}
})().catch(console.error);

function checkIfDateIsNotOlderThan(date: Date, milliseconds: number): boolean {
	return date.getTime() + milliseconds > new Date().getTime();
}

export async function createCustomStorageDatabase<T>(
	name: string,
	fileName: string,
	defaultData: T,
	cacheTimeMS: number = 1000 * 60 * 60
): Promise<CustomFileObjectDatabase<T>> {
	const _db = new CustomFileObjectDatabase<T>(name, fileName, cacheTimeMS);
	await _db.init(defaultData);
	return _db;
}

export async function createCustomStorageArrayDatabase<
	T extends { id: string },
	I
>(
	name: string,
	fileName: string,
	// defaultData: T[] = [],
	// cacheTimeMS: number = 1000 * 60 * 60,
	convertToItem: (toInsert: I) => T
): Promise<CustomFileArrayDatabase<T, I>> {
	const _db = new CustomFileArrayDatabase<T, I>(
		name,
		fileName,
		1000 * 60 * 60,
		convertToItem
	);
	await _db.init([]);
	return _db;
}
