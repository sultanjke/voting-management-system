"use client";

import Link from "next/link";

import { useI18n } from "@/components/language-provider";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main className="app-shell">
      <section className="glass-panel p-6">
        <h1 className="text-3xl">{t("notFound.title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("notFound.desc")}</p>
        <div className="mt-5">
          <Link className="secondary-btn" href="/">
            {t("notFound.home")}
          </Link>
        </div>
      </section>
    </main>
  );
}
