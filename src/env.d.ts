/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { Session, User } from "lucia";
import type { SingleImage, SingleVideo } from "@prisma/client";

declare global {
    declare namespace App {
        interface Locals {
            session: Session | null;
            customer: User | null;
            admin: boolean;
        }
    }
}

export interface SingleImageMemory {
    file_name: string;

    extension: string;
    mime: string;

    size: number;

    width: number;
    height: number;
    quality: number;
}

interface AdminSession {
    id: string;
}

interface NavigationLink {
    text: string;
    href: string;
    size: "small" | "medium";
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
    | FileUploadProps
    | FilesOrFolderUploadProps;

interface PerfectImageProps {
    type?: "image";
    title?: string;
    class?: string;
    alt?: string;
    decoding?: "sync" | "async" | "auto";
    loading?: "eager" | "lazy";
    width?: number;
    height?: number;

    images: SingleImage[];
    forceSizesW?: number[];

    inForUrl: "portfolio" | "box-files";
}

interface PerfectVideoProps {
    type?: "video";
    title?: string;
    class?: string;

    width?: number;
    height?: number;

    videoUrl: string;

    controls?: boolean;
    muted?: boolean;
    loop?: boolean;
    autoplay?: boolean;
    playsinline?: boolean | string;
    poster?: string | SingleImage | SingleImage[];
    disablepictureinpicture?: boolean;

    inForUrl: "portfolio" | "box-files";
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
    class?: string;
    id?: string;
    name?: string;
    placeholder?: string;
    value?: string;

    min?: number;
    max?: number;
    required?: boolean;

    oninput?: string;
    onchange?: string;
}

// InputSelectProps
interface InputSelectProps {
    type?: "select";
    name?: string;
    multiple?: boolean;
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
    submit?: boolean;
    id?: string;
    href?: string;
    openInNewTab?: boolean;
    class?: string | string[] | object;
    onclick?: string;
    size?: "small" | "medium" | "large";
    typeButton?: "primary" | "secondary" | "tertiary" | "danger";
    datasets?: object;
}

interface FieldsetProps {
    type?: "fieldset";
    title?: string;
    classParent?: string;
    class?: string | string[] | object;
    form?: boolean;
    formAction?: string;
    formMethod?: string;
}

interface FileUploadProps {
    type?: "file";
    size?: "normal" | "small";
    name?: string;
    multiple?: boolean;
    accept?: string;
    required?: boolean;
    class?: string;
    id?: string;
}

interface FilesOrFolderUploadProps {
    type?: "files-or-folder";
    size?: "normal" | "small";
    name?: string;
    accept?: string;
    required?: boolean;
    class?: string;
    id?: string;
}

type FileChunkUploaderProps = {
    type?: "file-chunk-uploader";
    size?: "normal" | "small";
    name?: string;
    accept?: string;
    required?: boolean;
    class?: string;
    id?: string;

    reloadAfterSuccessUpload?: boolean;

    chunkSize?: number;
    urlLocation: string;
    userCanDecideIfTheyWantToUploadADirectory?: boolean;
    showProgressBars?: boolean;
} & (
        {
            uploadMultipleFiles: true;
        } | {
            uploadMultipleFiles: false;
        }
    )
