"use client";

import { useEffect } from "react";

type ToastTone = "success" | "error" | "info";

type FloatingToastProps = {
  message: string | null;
  tone?: ToastTone;
  onClose?: () => void;
  autoHideMs?: number;
};

function toneClasses(tone: ToastTone): string {
  if (tone === "success") {
    return "border-green-300 bg-green-50 text-green-800";
  }
  if (tone === "error") {
    return "border-red-300 bg-red-50 text-red-800";
  }
  return "border-blue-300 bg-blue-50 text-blue-800";
}

function toneMark(tone: ToastTone): string {
  if (tone === "success") {
    return "OK";
  }
  if (tone === "error") {
    return "!";
  }
  return "i";
}

export function FloatingToast({ message, tone = "info", onClose, autoHideMs }: FloatingToastProps) {
  useEffect(() => {
    if (!message || !onClose || !autoHideMs) {
      return;
    }

    const timeoutId = window.setTimeout(() => onClose(), autoHideMs);
    return () => window.clearTimeout(timeoutId);
  }, [autoHideMs, message, onClose]);

  if (!message) {
    return null;
  }

  return (
    <div className="fixed left-1/2 top-4 z-[100] w-[min(92vw,560px)] -translate-x-1/2 px-2">
      <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 shadow-lg ${toneClasses(tone)}`} role={tone === "error" ? "alert" : "status"}>
        <span className="inline-flex min-w-6 items-center justify-center rounded-full border px-1 text-[11px] font-bold">
          {toneMark(tone)}
        </span>
        <p className="flex-1 text-sm font-medium">{message}</p>
        {onClose ? (
          <button
            aria-label="Close notification"
            className="rounded-md border border-current/30 px-2 py-0.5 text-xs opacity-80 hover:opacity-100"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        ) : null}
      </div>
    </div>
  );
}
