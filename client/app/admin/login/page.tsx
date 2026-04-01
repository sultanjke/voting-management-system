"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminLoginForm } from "@/components/admin-login-form";
import { PageLoader } from "@/components/page-loader";
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
    return <PageLoader />;
  }

  return <AdminLoginForm />;
}
