"use client";

import { useI18n } from "@/components/language-provider";

type Props = {
  className?: string;
};

export function LanguageSwitcher({ className }: Props) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className={`inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white/95 p-1 shadow-sm ${className ?? ""}`}>
      <button
        aria-label={t("switch.kk")}
        className={`rounded-md px-2 py-1 text-base ${lang === "kk" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
        onClick={() => setLang("kk")}
        type="button"
      >
        🇰🇿
      </button>
      <button
        aria-label={t("switch.ru")}
        className={`rounded-md px-2 py-1 text-base ${lang === "ru" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
        onClick={() => setLang("ru")}
        type="button"
      >
        🇷🇺
      </button>
    </div>
  );
}

