"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SurveyRunner } from "@/components/survey-runner";
import type { ResidentSessionResponse, ResidentSurveyDetail } from "@shared/contracts";

export default function SurveyPage() {
  const router = useRouter();
  const params = useParams<{ surveyId: string }>();
  const surveyId = params.surveyId;

  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState<ResidentSurveyDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const sessionResponse = await fetch("/api/resident/session", { credentials: "include", cache: "no-store" });
        const sessionPayload = (await sessionResponse.json()) as ResidentSessionResponse;
        if (!sessionPayload.authenticated) {
          router.replace("/");
          return;
        }

        const detailResponse = await fetch(`/api/resident/surveys/${surveyId}`, { credentials: "include", cache: "no-store" });
        if (detailResponse.status === 404) {
          setMissing(true);
          return;
        }
        if (!detailResponse.ok) {
          router.replace("/");
          return;
        }

        const detailPayload = (await detailResponse.json()) as { survey: ResidentSurveyDetail };
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
            <Link className="secondary-btn" href="/">
              Back
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <SurveyRunner
      surveyId={survey.id}
      title={survey.title}
      description={survey.description}
      status={survey.status}
      deadline={survey.deadline}
      alreadyVoted={survey.alreadyVoted}
      questions={survey.questions}
    />
  );
}
