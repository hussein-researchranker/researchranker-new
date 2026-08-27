"use client";

import Link from "next/link";
import { useEffect } from "react";

type ToastTone = "success" | "error" | "info";

type ToastProps = {
  message: string;
  tone?: ToastTone;
  onClose: () => void;
  duration?: number;
  actionHref?: string;
  actionLabel?: string;
};

const toneClasses: Record<ToastTone, string> = {
  success: "border-emerald-200 bg-white text-slate-900",
  error: "border-red-200 bg-white text-slate-900",
  info: "border-blue-200 bg-white text-slate-900",
};

const iconClasses: Record<ToastTone, string> = {
  success: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
};

const icons: Record<ToastTone, string> = {
  success: "✓",
  error: "!",
  info: "i",
};

export default function Toast({
  message,
  tone = "info",
  onClose,
  duration = 4200,
  actionHref,
  actionLabel,
}: ToastProps) {
  useEffect(() => {
    if (!message || duration <= 0) return;

    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [duration, message, onClose]);

  if (!message) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:left-6 sm:w-auto sm:min-w-[360px] sm:translate-x-0"
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      dir="rtl"
    >
      <div
        className={`flex items-start gap-3 rounded-2xl border p-4 shadow-[0_18px_50px_rgba(15,23,42,0.18)] ${toneClasses[tone]}`}
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black ${iconClasses[tone]}`}
          aria-hidden="true"
        >
          {icons[tone]}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-6">{message}</p>
          {actionHref && actionLabel && (
            <Link
              href={actionHref}
              className="mt-2 inline-flex text-xs font-black text-blue-700 hover:text-blue-800"
            >
              {actionLabel} ←
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق الإشعار"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-lg font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          ×
        </button>
      </div>
    </div>
  );
}
