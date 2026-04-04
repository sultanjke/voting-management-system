"use client";

import Link from "next/link";
import type { SurveyStatus } from "@shared/contracts";

import { useI18n } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { formatLocalizedDateTime } from "@/lib/date-time";
import { decodeLocalizedText } from "@/lib/localized-text";

type SurveyQuestion = {
  id: string;
  text: string;
};

type SurveyVoteAnswer = {
  questionId: string;
  optionLabel: string | null;
  scaleValue: number | null;
  textValue: string | null;
};

type SurveyVote = {
  id: string;
  houseCode: string;
  submittedAt: string;
  answers: SurveyVoteAnswer[];
};

type SurveyDetails = {
  id: string;
  title: string;
  status: SurveyStatus;
  deadline: string | null;
  voteCount: number;
  totalEligible: number;
  questions: SurveyQuestion[];
  votes: SurveyVote[];
};

function statusLabel(status: SurveyStatus, t: (key: string) => string): string {
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

function statusBadgeClass(status: SurveyStatus): string {
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

function ExcelIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="18" height="20" rx="3" fill="#1F9D55" />
      <path d="M9 8L15 16M15 8L9 16" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 2V8H21" stroke="#E5F7EC" strokeWidth="2" />
    </svg>
  );
}

export function AdminSurveyResults({ survey }: { survey: SurveyDetails }) {
  const { t, lang } = useI18n();
  const participation = survey.totalEligible > 0 ? Math.round((survey.voteCount / survey.totalEligible) * 100) : 0;
  const deadlineText = survey.deadline ? formatLocalizedDateTime(survey.deadline, lang) : null;
  const csvDownloadHref = `/api/admin/surveys/${survey.id}/results/csv?lang=${lang}`;

  const renderAnswerValue = (answer: SurveyVoteAnswer): string => {
    if (answer.optionLabel) {
      return decodeLocalizedText(answer.optionLabel, lang) ?? answer.optionLabel;
    }
    if (typeof answer.scaleValue === "number") {
      return `(${answer.scaleValue}/5)`;
    }
    if (answer.textValue) {
      return answer.textValue;
    }
    return t("admin.answerMissing");
  };

  return (
    <main className="app-shell space-y-4">
      <section className="glass-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{t("admin.voteDetails")}</p>
            <h1 className="text-3xl">{decodeLocalizedText(survey.title, lang) ?? survey.title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {survey.voteCount}/{survey.totalEligible} ({participation}%)
            </p>
            {deadlineText ? (
              <p className="mt-1 text-sm text-slate-600">
                {t("admin.deadline")}: {deadlineText}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <span className={statusBadgeClass(survey.status)}>{statusLabel(survey.status, t)}</span>
            <a className="secondary-btn inline-flex items-center gap-2 whitespace-nowrap" href={csvDownloadHref}>
              <ExcelIcon />
              {t("admin.downloadCsv")}
            </a>
            <Link className="secondary-btn" href="/admin">
              {t("admin.backToSurveys")}
            </Link>
          </div>
        </div>
      </section>

      <section className="glass-panel p-5">
        {survey.votes.length === 0 ? (
          <p className="text-sm text-slate-500">{t("admin.noVotesYet")}</p>
        ) : (
          <div className="space-y-3">
            {survey.votes.map((vote) => {
              const answersByQuestion = new Map(vote.answers.map((answer) => [answer.questionId, answer]));
              return (
                <article className="rounded-xl border border-slate-200 bg-white p-4" key={vote.id}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      {t("admin.house")}: <strong>{vote.houseCode}</strong>
                    </span>
                    <span className="text-slate-500">
                      {t("admin.submittedAt")}: {formatLocalizedDateTime(vote.submittedAt, lang)}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    {survey.questions.map((question) => {
                      const answer = answersByQuestion.get(question.id);
                      return (
                        <div className="flex flex-wrap justify-between gap-2 border-b border-slate-200 pb-2" key={`${vote.id}-${question.id}`}>
                          <span className="text-slate-700">{decodeLocalizedText(question.text, lang) ?? question.text}</span>
                          <span className="font-medium text-slate-900">{answer ? renderAnswerValue(answer) : t("admin.answerMissing")}</span>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
