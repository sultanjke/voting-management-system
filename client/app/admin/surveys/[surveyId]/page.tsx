"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminSurveyResults } from "@/components/admin-survey-results";
import type { AdminSessionResponse, AdminSurveyResultsPayload } from "@shared/contracts";

export default function AdminSurveyResultsPage() {
  const router = useRouter();
  const params = useParams<{ surveyId: string }>();
  const surveyId = params.surveyId;

  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState<AdminSurveyResultsPayload | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const sessionResponse = await fetch("/api/admin/session", { credentials: "include", cache: "no-store" });
        const sessionPayload = (await sessionResponse.json()) as AdminSessionResponse;
        if (!sessionPayload.authenticated) {
          router.replace("/admin/login");
          return;
        }

        const detailResponse = await fetch(`/api/admin/surveys/${surveyId}/results`, {
          credentials: "include",
          cache: "no-store"
        });
        if (detailResponse.status === 404) {
          setMissing(true);
          return;
        }
        if (!detailResponse.ok) {
          router.replace("/admin");
          return;
        }

        const detailPayload = (await detailResponse.json()) as { survey: AdminSurveyResultsPayload };
        setSurvey(detailPayload.survey);
      } finally {
        setLoading(false);
      }
    };

    if (surveyId) {
      void load();
    }
  }, [router, surveyId]);

  if (loading) {
    return (
      <main className="app-shell">
        <section className="glass-panel p-6">
          <p className="text-sm text-slate-600">Loading...</p>
        </section>
      </main>
    );
  }

  if (missing || !survey) {
    return (
      <main className="app-shell">
        <section className="glass-panel p-6">
          <h1 className="text-3xl">Survey not found</h1>
          <div className="mt-5">
            <Link className="secondary-btn" href="/admin">
              Back
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return <AdminSurveyResults survey={survey} />;
}
