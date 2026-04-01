"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useI18n } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { formatLocalizedDateTime } from "@/lib/date-time";
import { decodeLocalizedText } from "@/lib/localized-text";
import type { ResidentSurveyCard } from "@shared/contracts";

type Props = {
  houseCode: string;
  surveys: ResidentSurveyCard[];
};

const SESSION_HINT_POPUP_FLAG = "rv_show_session_hint_popup";

function statusBadge(status: string, t: (key: string) => string) {
  if (status === "ACTIVE") {
    return <span className="badge badge-active">{t("status.active")}</span>;
  }
  if (status === "CLOSED") {
    return <span className="badge badge-closed">{t("status.closed")}</span>;
  }
  if (status === "ARCHIVED") {
    return <span className="badge badge-archived">{t("status.archived")}</span>;
  }
  return <span className="badge badge-draft">{t("status.draft")}</span>;
}

export function ResidentDashboard({ houseCode, surveys }: Props) {
  const { t, lang } = useI18n();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showSessionHint, setShowSessionHint] = useState(false);

  const activeCount = surveys.filter((survey) => survey.status === "ACTIVE").length;
  const completedCount = surveys.filter((survey) => survey.alreadyVoted).length;

  useEffect(() => {
    try {
      const shouldShow = window.sessionStorage.getItem(SESSION_HINT_POPUP_FLAG) === "1";
      if (!shouldShow) {
        return;
      }
      setShowSessionHint(true);
    } catch {
      // ignore browser storage issues
      return;
    }
  }, []);

  const closeSessionHint = () => {
    try {
      window.sessionStorage.removeItem(SESSION_HINT_POPUP_FLAG);
    } catch {
      // ignore browser storage issues
    }
    setShowSessionHint(false);
  };

  const logout = async () => {
    setLoggingOut(true);
    await fetch("/api/resident/auth/logout", { method: "POST", credentials: "include" });
    window.location.reload();
  };

  return (
    <main className="app-shell space-y-5">
      {showSessionHint ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-blue-200 bg-white px-5 py-5 text-slate-900 shadow-xl">
            <p className="flex items-start gap-2 text-sm leading-6 text-slate-700">
              <span
                aria-hidden="true"
                className="mt-[5px] inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border border-red-400 text-[10px] font-bold text-red-700"
              >
                !
              </span>
              <span>{t("residentLogin.sessionHint")}</span>
            </p>
            <button className="primary-btn mt-4 w-full" onClick={closeSessionHint} type="button">
              {t("residentDashboard.sessionHintClose")}
            </button>
          </div>
        </div>
      ) : null}

      <section className="glass-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.17em] text-slate-600">{t("residentDashboard.portal")}</p>
            <h1 className="mt-3 text-4xl mb-3">🏡 {t("residentDashboard.house", { house: houseCode })}</h1>
            <p className="mt-2 text-sm text-slate-600">{t("residentDashboard.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link className="secondary-btn" href="/results">
              {t("residentDashboard.viewResults")}
            </Link>
            <button className="danger-btn" disabled={loggingOut} onClick={logout} type="button">
              {loggingOut ? t("residentDashboard.signingOut") : t("residentDashboard.signOut")}
            </button>
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <p className="text-xs uppercase tracking-[0.1em] text-slate-500">{t("residentDashboard.totalSurveys")}</p>
          <p className="mt-1 text-3xl font-semibold">{surveys.length}</p>
        </article>
        <article className="kpi-card">
          <p className="text-xs uppercase tracking-[0.1em] text-slate-500">{t("residentDashboard.active")}</p>
          <p className="mt-1 text-3xl font-semibold">{activeCount}</p>
        </article>
        <article className="kpi-card">
          <p className="text-xs uppercase tracking-[0.1em] text-slate-500">{t("residentDashboard.submittedByHouse")}</p>
          <p className="mt-1 text-3xl font-semibold">{completedCount}</p>
        </article>
      </section>

      <section className="glass-panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl">{t("residentDashboard.queue")}</h2>
        </div>

        <div className="grid gap-3">
          {surveys.map((survey) => {
            const participation = survey.totalEligible > 0 ? Math.round((survey.voteCount / survey.totalEligible) * 100) : 0;
            const canVote = survey.status === "ACTIVE" && !survey.alreadyVoted;
            const deadline = survey.deadline ? formatLocalizedDateTime(survey.deadline, lang) : null;
            const surveyTitle = decodeLocalizedText(survey.title, lang) ?? survey.title;
            const surveyDescription = decodeLocalizedText(survey.description, lang) ?? t("residentDashboard.noDescription");
            return (
              <article className="glass-panel p-4" key={survey.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xl">{surveyTitle}</h3>
                    <p className="mt-1 text-sm text-slate-600">{surveyDescription}</p>
                  </div>
                  <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
                    {statusBadge(survey.status, t)}
                    {survey.alreadyVoted ? <span className="badge badge-active">{t("residentDashboard.alreadySubmitted")}</span> : null}
                  </div>
                </div>

                {deadline ? (
                  <p className="mt-2 text-sm text-slate-600">
                    {t("residentDashboard.deadline")}: <strong>{deadline}</strong>
                  </p>
                ) : null}

                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-5">
                  <p>
                    {t("residentDashboard.questions")}: <strong>{survey.questionCount}</strong>
                  </p>
                  <p>
                    {t("residentDashboard.participation")}: <strong>{survey.voteCount}</strong> / {survey.totalEligible}
                  </p>
                </div>

                <div className="mt-2 progress-track">
                  <div className="progress-fill" style={{ width: `${participation}%` }} />
                </div>

                <div className="mt-3 flex justify-end">
                  {canVote ? (
                    <Link className="primary-btn" href={`/survey/${survey.id}`}>
                      {t("residentDashboard.startSurvey")}
                    </Link>
                  ) : (
                    <button className="secondary-btn" disabled type="button">
                      {survey.status === "CLOSED" ? t("status.closed") : t("residentDashboard.submitted")}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
