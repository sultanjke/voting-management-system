"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminPanel } from "@/components/admin-panel";
import { PageLoader } from "@/components/page-loader";
import type {
  AdminResidentRow,
  AdminSessionResponse,
  AdminSurveyRow,
  ParticipationRow
} from "@shared/contracts";

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adminLogin, setAdminLogin] = useState("");
  const [residents, setResidents] = useState<AdminResidentRow[]>([]);
  const [surveys, setSurveys] = useState<AdminSurveyRow[]>([]);
  const [analytics, setAnalytics] = useState<ParticipationRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const sessionResponse = await fetch("/api/admin/session", { credentials: "include", cache: "no-store" });
        const sessionPayload = (await sessionResponse.json()) as AdminSessionResponse;
        if (!sessionPayload.authenticated) {
          router.replace("/admin/login");
          return;
        }

        setAdminLogin(sessionPayload.admin.login);

        const [residentsResponse, surveysResponse, analyticsResponse] = await Promise.all([
          fetch("/api/admin/residents", { credentials: "include", cache: "no-store" }),
          fetch("/api/admin/surveys", { credentials: "include", cache: "no-store" }),
          fetch("/api/admin/analytics/participation", { credentials: "include", cache: "no-store" })
        ]);

        if (!residentsResponse.ok || !surveysResponse.ok || !analyticsResponse.ok) {
          router.replace("/admin/login");
          return;
        }

        const residentsPayload = (await residentsResponse.json()) as { residents: AdminResidentRow[] };
        const surveysPayload = (await surveysResponse.json()) as { surveys: AdminSurveyRow[] };
        const analyticsPayload = (await analyticsResponse.json()) as { analytics: ParticipationRow[] };

        setResidents(residentsPayload.residents);
        setSurveys(surveysPayload.surveys);
        setAnalytics(analyticsPayload.analytics);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router]);

  if (loading) {
    return <PageLoader />;
  }

  return <AdminPanel adminEmail={adminLogin} residents={residents} surveys={surveys} analytics={analytics} />;
}
