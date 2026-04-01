"use client";

import { useEffect, useState } from "react";

import { PageLoader } from "@/components/page-loader";
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
    return <PageLoader />;
  }

  if (!session?.authenticated) {
    return <ResidentLogin />;
  }

  return <ResidentDashboard houseCode={session.resident.houseCode} surveys={surveys} />;
}
