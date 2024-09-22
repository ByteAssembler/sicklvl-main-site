import type { BoxFile } from "@prisma/client";

interface NeededAccessProps {
	owner_id: string | null;
	password: string | null;
	is_public: boolean;
	password_for_owner: boolean;
	password_for_public: boolean;
}

export enum AccessResult {
	Allowed = "allowed",
	NotAllowed = "not-allowed",
	PasswordIncorrect = "password-incorrect",
}

export function BOXhasAccessToFolder(box: NeededAccessProps | null, isAdmin?: boolean, customerId?: string | null | undefined, password?: string | null | undefined): AccessResult {
	if (!box) return AccessResult.NotAllowed;

	// Admins have access to all folders
	if (isAdmin) return AccessResult.Allowed;

	// Check if the customer has access to the folder (note: a customer can have access also a public folder)
	if (box.owner_id && box.owner_id === customerId) {
		if (box.password_for_owner) {
			return box.password === password ? AccessResult.Allowed : AccessResult.PasswordIncorrect;
		} else {
			return AccessResult.Allowed;
		}
	}

	// Check if the folder is public and the customer has the password
	if (box.is_public) {
		if (box.password_for_public || box.password_for_owner) {
			return box.password === password ? AccessResult.Allowed : AccessResult.PasswordIncorrect;
		} else {
			return AccessResult.Allowed;
		}
	}

	return AccessResult.NotAllowed;
}

export function BOXhasAccessToFile(file: BoxFile & {
	box: NeededAccessProps;
}, isAdmin?: boolean, customerId?: string | null | undefined, password?: string | null | undefined) {
	return BOXhasAccessToFolder(file.box, isAdmin, customerId, password);
}
