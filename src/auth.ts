// src/auth.ts
import {
	Lucia,
	type Adapter,
	type DatabaseSession,
	type DatabaseUser,
} from "lucia";

import { globalDB } from "./utils/cdate";

const userDB = globalDB.users;
const sessionDB = globalDB.sessions;

const customAdapter: Adapter = {
	async deleteExpiredSessions() {
		const now = new Date();
		await sessionDB.deleteMany((session) => session.expiresAt < now);
	},
	async deleteSession(sessionId) {
		await sessionDB.deleteOne((session) => session.id === sessionId);
	},
	async deleteUserSessions(userId) {
		await sessionDB.deleteMany((session) => session.userId === userId);
	},
	async getSessionAndUser(
		sessionId
	): Promise<[DatabaseSession | null, DatabaseUser | null]> {
		const session = await sessionDB.findOne(
			(session) => session.id === sessionId
		);
		if (!session) return [null, null];
		let user: DatabaseUser | undefined | null = await userDB.findOne(
			(user) => user.id === session.userId
		);
		if (!user) user = null;
		return [session, user];
	},
	async getUserSessions(userId) {
		return (await sessionDB.getArray()).filter(
			(session) => session.userId === userId
		);
	},
	async setSession(session) {
		await sessionDB.addToArray(session);
	},
	async updateSessionExpiration(sessionId, expiresAt) {
		await sessionDB.updateOne(
			(session) => session.id === sessionId,
			(session) => ({ ...session, expiresAt })
		);
	},
};

export const lucia = new Lucia(customAdapter, {
	sessionCookie: {
		attributes: {
			// set to `true` when using HTTPS
			secure: import.meta.env.PROD ?? "u!m$QYGUUJbsErRPV9x&GMfhdGG%rSeHWZP5h22JyoJp!LK9!6",
		},
	},
});

declare module "lucia" {
	interface Register {
		Lucia: typeof lucia;
	}
}
