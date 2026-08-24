import type { InputHTMLAttributes, ReactNode } from "react";

export type PopupTone = "info" | "success" | "warning" | "error";
export type PopupInputValues = Readonly<Record<string, string>>;

export interface PopupBaseOptions {
  readonly title: string;
  readonly message?: ReactNode;
  readonly eyebrow?: string;
  readonly tone?: PopupTone;
  readonly blurBackground?: boolean;
  readonly closeOnBackdrop?: boolean;
  readonly closeOnEscape?: boolean;
}

export interface MessagePopupOptions extends PopupBaseOptions {
  readonly confirmLabel?: string;
}

export interface ConfirmPopupOptions extends PopupBaseOptions {
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
}

export interface PopupInputField {
  readonly name: string;
  readonly label: string;
  readonly type?: "text" | "password" | "email" | "number";
  readonly inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  readonly autoComplete?: string;
  readonly placeholder?: string;
  readonly initialValue?: string;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly required?: boolean;
  readonly autoFocus?: boolean;
  readonly validate?: (value: string, values: PopupInputValues) => string | null;
}

export interface InputPopupOptions extends PopupBaseOptions {
  readonly fields: readonly PopupInputField[];
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly allowCancel?: boolean;
  readonly clearOnError?: boolean;
  readonly validate?: (values: PopupInputValues) => string | null;
  readonly onConfirm?: (values: PopupInputValues) => string | null | Promise<string | null>;
}

export interface PopupController {
  readonly showMessage: (options: MessagePopupOptions) => Promise<void>;
  readonly requestConfirmation: (options: ConfirmPopupOptions) => Promise<boolean>;
  readonly requestInput: (options: InputPopupOptions) => Promise<PopupInputValues | null>;
}
