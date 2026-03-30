"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminLoginForm } from "@/components/admin-login-form";
import type { AdminSessionResponse } from "@shared/contracts";

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const sessionResponse = await fetch("/api/admin/session", { credentials: "include", cache: "no-store" });
        const sessionPayload = (await sessionResponse.json()) as AdminSessionResponse;
        if (sessionPayload.authenticated) {
          router.replace("/admin");
          return;
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router]);

  if (loading) {
    return (
      <main className="app-shell">
        <section className="glass-panel p-6">
          <p className="text-sm text-slate-600">Loading...</p>
        </section>
      </main>
    );
  }

  return <AdminLoginForm />;
}
