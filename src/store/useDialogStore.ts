import { create } from "zustand";

export type DialogVariant = "danger" | "warning" | "info" | "primary";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

export interface AlertOptions {
  title?: string;
  message: string;
  buttonText?: string;
  variant?: DialogVariant;
}

interface DialogState {
  open: boolean;
  mode: "confirm" | "alert";
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  buttonText: string;
  variant: DialogVariant;
  resolve: ((value: boolean) => void) | null;
}

interface DialogActions {
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>;
  alert: (opts: AlertOptions | string) => Promise<void>;
  close: (ok: boolean) => void;
}

const DEFAULTS = {
  title: "",
  confirmText: "Confirm",
  cancelText: "Cancel",
  buttonText: "OK",
  variant: "info" as DialogVariant,
};

export const useDialogStore = create<DialogState & DialogActions>((set, get) => ({
  open: false,
  mode: "confirm",
  title: "",
  message: "",
  confirmText: DEFAULTS.confirmText,
  cancelText: DEFAULTS.cancelText,
  buttonText: DEFAULTS.buttonText,
  variant: DEFAULTS.variant,
  resolve: null,

  confirm: (opts) => {
    const o: ConfirmOptions = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      set({
        open: true,
        mode: "confirm",
        title: o.title ?? DEFAULTS.title,
        message: o.message,
        confirmText: o.confirmText ?? DEFAULTS.confirmText,
        cancelText: o.cancelText ?? DEFAULTS.cancelText,
        variant: o.variant ?? DEFAULTS.variant,
        resolve,
      });
    });
  },

  alert: (opts) => {
    const o: AlertOptions = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<void>((resolve) => {
      set({
        open: true,
        mode: "alert",
        title: o.title ?? DEFAULTS.title,
        message: o.message,
        buttonText: o.buttonText ?? DEFAULTS.buttonText,
        variant: o.variant ?? DEFAULTS.variant,
        resolve: () => resolve(),
      });
    });
  },

  close: (ok) => {
    const { resolve } = get();
    set({
      open: false,
      resolve: null,
    });
    resolve?.(ok);
  },
}));