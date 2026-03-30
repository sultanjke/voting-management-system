"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ResultsView } from "@/components/results-view";
import type { ResidentResultsPayload, ResidentSessionResponse } from "@shared/contracts";

export default function ResultsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<ResidentResultsPayload[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const sessionResponse = await fetch("/api/resident/session", { credentials: "include", cache: "no-store" });
        const sessionPayload = (await sessionResponse.json()) as ResidentSessionResponse;
        if (!sessionPayload.authenticated) {
          router.replace("/");
          return;
        }

        const resultsResponse = await fetch("/api/resident/results", { credentials: "include", cache: "no-store" });
        if (!resultsResponse.ok) {
          router.replace("/");
          return;
        }
        const resultsPayload = (await resultsResponse.json()) as { results: ResidentResultsPayload[] };
        setSurveys(resultsPayload.results);
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

  return <ResultsView surveys={surveys} />;
}
