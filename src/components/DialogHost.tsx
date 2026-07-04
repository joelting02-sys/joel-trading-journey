import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info, Trash2, CheckCircle2 } from "lucide-react";
import { useDialogStore, type DialogVariant } from "@/store/useDialogStore";

const variantMeta: Record<
  DialogVariant,
  { icon: typeof AlertTriangle; iconClass: string; confirmClass: string }
> = {
  danger: {
    icon: Trash2,
    iconClass: "bg-loss/12 text-loss",
    confirmClass: "bg-loss text-white hover:bg-loss-dim",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "bg-warning/15 text-warning",
    confirmClass: "bg-warning text-white hover:opacity-90",
  },
  info: {
    icon: Info,
    iconClass: "bg-info/15 text-info",
    confirmClass: "bg-info text-white hover:opacity-90",
  },
  primary: {
    icon: CheckCircle2,
    iconClass: "bg-primary/12 text-primary",
    confirmClass: "bg-primary text-white hover:bg-primary-dim",
  },
};

export default function DialogHost() {
  const state = useDialogStore();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 打开时焦点默认落在"取消"按钮(防误删),支持 Esc 关闭
  useEffect(() => {
    if (!state.open) return;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") state.close(false);
      if (e.key === "Enter" && state.mode === "alert") state.close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open]);

  if (!state.open) return null;

  const meta = variantMeta[state.variant];
  const Icon = meta.icon;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 animate-fade-in"
      onMouseDown={(e) => {
        // 点遮罩 = 取消(等价于原生 confirm 的取消行为)
        if (e.target === e.currentTarget) state.close(false);
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tj-dialog-title"
        aria-describedby="tj-dialog-desc"
        className="w-full max-w-[420px] rounded-lg border border-border bg-bg-surface shadow-float animate-fade-in-up"
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.iconClass}`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            {state.title && (
              <h2
                id="tj-dialog-title"
                className="font-display text-base font-semibold leading-tight text-text"
              >
                {state.title}
              </h2>
            )}
            <p
              id="tj-dialog-desc"
              className={`whitespace-pre-line text-sm leading-relaxed text-text-secondary ${
                state.title ? "mt-1.5" : ""
              }`}
            >
              {state.message}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3">
          {state.mode === "confirm" && (
            <button
              ref={cancelRef}
              type="button"
              onClick={() => state.close(false)}
              className="rounded-md border border-border bg-bg-surface px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text"
            >
              {state.cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={() => state.close(true)}
            autoFocus={state.mode === "alert"}
            className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${meta.confirmClass}`}
          >
            {state.mode === "confirm" ? state.confirmText : state.buttonText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}