"use client";

import Link from "next/link";
import type { SurveyStatus } from "@shared/contracts";

import { useI18n } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { decodeLocalizedText } from "@/lib/localized-text";

type ResultQuestion = {
  id: string;
  type: "SINGLE" | "SCALE" | "TEXT";
  text: string;
  data:
    | Array<{ optionId: string; label: string; count: number }>
    | Array<{ value: number; count: number }>
    | string[];
};

type ResultSurvey = {
  id: string;
  title: string;
  status: SurveyStatus;
  participation: {
    responded: number;
    totalEligible: number;
    percentage: number;
  };
  questions: ResultQuestion[];
};

function statusLabel(status: string, t: (key: string) => string): string {
  if (status === "ACTIVE") {
    return t("status.active");
  }
  if (status === "CLOSED") {
    return t("status.closed");
  }
  if (status === "ARCHIVED") {
    return t("status.archived");
  }
  return t("status.draft");
}

function statusBadgeClass(status: string): string {
  if (status === "ACTIVE") {
    return "badge badge-active";
  }
  if (status === "CLOSED") {
    return "badge badge-closed";
  }
  if (status === "ARCHIVED") {
    return "badge badge-archived";
  }
  return "badge badge-draft";
}

export function ResultsView({ surveys }: { surveys: ResultSurvey[] }) {
  const { t, lang } = useI18n();

  return (
    <main className="app-shell space-y-4">
      <section className="glass-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{t("results.insight")}</p>
            <h1 className="text-3xl">{t("results.title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link className="secondary-btn" href="/">
              {t("results.back")}
            </Link>
          </div>
        </div>
      </section>

      {surveys.map((survey) => (
        <section className="glass-panel p-5" key={survey.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl">{decodeLocalizedText(survey.title, lang) ?? survey.title}</h2>
            <span className={statusBadgeClass(survey.status)}>{statusLabel(survey.status, t)}</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {t("results.participation")}: {survey.participation.responded} / {survey.participation.totalEligible} ({survey.participation.percentage}
            %)
          </p>
          <div className="mt-2 progress-track">
            <div className="progress-fill" style={{ width: `${survey.participation.percentage}%` }} />
          </div>

          <div className="mt-5 space-y-4">
            {survey.questions.map((question) => (
                <article className="rounded-xl border border-slate-200 bg-white p-4" key={question.id}>
                  <h3 className="text-lg">{decodeLocalizedText(question.text, lang) ?? question.text}</h3>

                  {question.type === "SINGLE"
                    ? (question.data as Array<{ optionId: string; label: string; count: number }>).map((option) => (
                        <div className="mt-2" key={option.optionId}>
                          <div className="flex justify-between text-sm text-slate-700">
                            <span>{decodeLocalizedText(option.label, lang) ?? option.label}</span>
                            <span>{option.count}</span>
                          </div>
                        </div>
                      ))
                    : null}

                  {question.type === "SCALE"
                    ? (question.data as Array<{ value: number; count: number }>).map((bucket) => (
                        <div className="mt-2 flex justify-between text-sm text-slate-700" key={bucket.value}>
                          <span>{t("results.score", { value: bucket.value })}</span>
                          <span>{bucket.count}</span>
                        </div>
                      ))
                    : null}

                  {question.type === "TEXT" ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {(question.data as string[]).length === 0 ? <li>{t("results.noText")}</li> : null}
                      {(question.data as string[]).map((entry, index) => (
                        <li key={`${question.id}-${index}`}>{entry}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
          </div>
        </section>
      ))}
    </main>
  );
}
