"use client";

import Link from "next/link";
import { useState } from "react";

import { FloatingToast } from "@/components/floating-toast";
import { useI18n } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

export function AdminLoginForm() {
  const { t } = useI18n();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password })
      });

      if (!response.ok) {
        setError(t("adminLogin.failed"));
        return;
      }

      setInfo(t("adminLogin.success"));
      window.setTimeout(() => {
        window.location.href = "/admin";
      }, 700);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell relative flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <FloatingToast autoHideMs={2000} message={info} onClose={() => setInfo(null)} tone="success" />
      <FloatingToast autoHideMs={5000} message={error} onClose={() => setError(null)} tone="error" />

      <div className="fixed right-4 top-4 z-30">
        <LanguageSwitcher />
      </div>
      <section className="glass-panel w-full max-w-lg p-7">
        <h1 className="text-3xl mb-5 font-bold">{t("adminLogin.title")}</h1>
        <p className="mt-5 text-sm text-slate-600">{t("adminLogin.subtitle")}</p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="field-label" htmlFor="admin-login">
              {t("adminLogin.email")}
            </label>
            <input
              id="admin-login"
              autoCapitalize="none"
              autoComplete="username"
              className="field-input"
              onChange={(event) => setLogin(event.target.value)}
              type="text"
              value={login}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="admin-password">
              {t("adminLogin.password")}
            </label>
            <input
              id="admin-password"
              className="field-input"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </div>
          <button className="primary-btn w-full" disabled={loading} onClick={submit} type="button">
            {loading ? t("adminLogin.signingIn") : t("adminLogin.signIn")}
          </button>
          <div className="text-center">
            <Link
              className="text-sm text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
              href="/"
            >
              {t("adminLogin.goToResident")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
