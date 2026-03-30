"use client";

import { useEffect, useState } from "react";

import { ResidentDashboard } from "@/components/resident-dashboard";
import { ResidentLogin } from "@/components/resident-login";
import type { ResidentSessionResponse, ResidentSurveyCard } from "@shared/contracts";

export default function ResidentHomePage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ResidentSessionResponse | null>(null);
  const [surveys, setSurveys] = useState<ResidentSurveyCard[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const sessionResponse = await fetch("/api/resident/session", { credentials: "include", cache: "no-store" });
        const sessionPayload = (await sessionResponse.json()) as ResidentSessionResponse;
        setSession(sessionPayload);

        if (!sessionPayload.authenticated) {
          return;
        }

        const surveysResponse = await fetch("/api/resident/surveys", { credentials: "include", cache: "no-store" });
        if (!surveysResponse.ok) {
          return;
        }
        const surveysPayload = (await surveysResponse.json()) as { surveys: ResidentSurveyCard[] };
        setSurveys(surveysPayload.surveys);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) {
    return (
      <main className="app-shell">
        <section className="glass-panel p-6">
          <p className="text-sm text-slate-600">Loading...</p>
        </section>
      </main>
    );
  }

  if (!session?.authenticated) {
    return <ResidentLogin />;
  }

  return <ResidentDashboard houseCode={session.resident.houseCode} surveys={surveys} />;
}
