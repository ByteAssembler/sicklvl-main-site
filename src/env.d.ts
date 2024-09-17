/// <reference path="../.astro/types.d.ts" />

type UserRoles = "admin" | "user";

/*interface UserSession {
	id: string;
	userId: number;
	expiresAt: Date;
	fresh: boolean;
}*/

type UserSession = import("lucia").DatabaseSession;
type User = import("lucia").DatabaseUser & UserBase;

interface UserBase {
	id: string;
	name: string;
	email: string;
	telephone: string;
	password: string;
	role: UserRoles;
	show: boolean;
}

interface PortfolioWithInfos {
	max_portfolio_count: number;
	current_portfolio_count: number;
	prev: PortfolioItem;
	current: PortfolioItem;
	next: PortfolioItem;
}

interface PortfolioItemCreateBase {
	slug: string;
	title: string;
	description: string;
	content: string;

	image_vertical: CImage[];
	image_horizontal: CImage[];

	image_gallery: CImage[][];
	video_gallery: VideoGallery;
}

interface PortfolioItem extends PortfolioItemCreateBase {
	id: string;
}

type Portfolio = PortfolioItem[];

interface VideoGallery {
	trailer?: CVideo; // Optional, falls kein Trailer vorhanden ist
	video?: CVideo; // Optional, falls kein Video vorhanden ist
}

interface CVideo {
	url: string; // URL oder Dateipfad
	thumbnail?: CImage[]; // Optionales Vorschaubild
}

interface CImage {
	file_name: string;
	width: number;
	height: number;
	mime: string;
	extension: string;
	size: number;
	quality: number;
}

/// <reference types="astro/client" />
declare namespace App {
	interface Locals {
		session: import("lucia").Session | null;
		user: User | null;
	}
}

/////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////

type ComponentProps =
	| PerfectImageProps
	| PerfectVideoProps
	| InputSelectProps
	| InputFieldProps
	| LabelProps
	| ButtonProps
	| FieldsetProps
	| FileUploadProps;

interface PerfectImageProps {
	type?: "image";
	title?: string;
	class?: string;
	alt?: string;
	decoding?: "sync" | "async" | "auto";
	loading?: "eager" | "lazy";
	width?: number;
	height?: number;
	images: CImage[];
	forceSizesW?: number[];
}

interface PerfectVideoProps {
	type?: "video";
	title?: string;
	class?: string;

	width?: number;
	height?: number;

	video: CVideo;

	controls?: boolean;
	playsinline?: boolean | string;
	poster?: string | CImage | CImage[];
	disablepictureinpicture?: boolean;
}

interface InputFieldProps {
	type?:
		| "text"
		| "email"
		| "password"
		| "number"
		| "tel"
		| "url"
		| "checkbox"
		| "radio"
		| "submit"
		| "reset";
	name?: string;
	placeholder?: string;
	value?: string;

	min?: number;
	max?: number;
	required?: boolean;
}

// InputSelectProps
interface InputSelectProps {
	type?: "select";
	name?: string;
	options: (
		| {
				text?: string;
				value: string;
				selected?: boolean;
				disabled?: boolean;
		  }
		| string
	)[];
	required?: boolean;
}

interface LabelProps {
	type?: "label";
	for?: string;
}

interface ButtonProps {
	type?: "button";
	id?: string;
	href?: string;
	class?: string | string[] | object;
	onclick?: string;
}

interface FieldsetProps {
	type?: "fieldset";
	title?: string;
	class?: string | string[] | object;
	form?: boolean;
	formAction?: string;
	formMethod?: string;
}

interface FileUploadProps {
	type?: "file";
	name?: string;
	multiple?: boolean;
	accept?: string;
}
