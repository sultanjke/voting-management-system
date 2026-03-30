"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ParticipationRow, ResidentStatus, SurveyStatus } from "@shared/contracts";

import { useI18n } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { decodeLocalizedText } from "@/lib/localized-text";

type ResidentRow = {
  id: string;
  houseCode: string;
  phoneNormalized: string;
  status: ResidentStatus;
  votes: number;
};

type SurveyRow = {
  id: string;
  title: string;
  status: SurveyStatus;
  deadline: string | null;
  voteCount: number;
  totalEligible: number;
};

type Props = {
  adminEmail: string;
  residents: ResidentRow[];
  surveys: SurveyRow[];
  analytics: ParticipationRow[];
};

type CreateSurveyResponse = {
  survey?: SurveyRow;
  error?: string;
};

type ApiErrorResponse = {
  error?: string;
};

type NewQuestion = {
  type: "SINGLE" | "SCALE" | "TEXT";
  text: string;
  description?: string;
  options?: string[];
};

type QuestionDraft = {
  id: string;
  type: "SINGLE" | "SCALE" | "TEXT";
  text: string;
  description: string;
  options: string[];
};

function createDraftId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function createInitialQuestions(lang: "kk" | "ru"): QuestionDraft[] {
  return [
    {
      id: createDraftId(),
      type: "SINGLE",
      text: lang === "kk" ? "Ұсынысты мақұлдайсыз ба?" : "Поддерживаете ли вы предложение?",
      description: "",
      options:
        lang === "kk"
          ? ["Иә, қолдаймын", "Түзетулермен қолдаймын", "Қарсымын"]
          : ["Да, поддерживаю", "Поддерживаю с изменениями", "Против"]
    },
    {
      id: createDraftId(),
      type: "TEXT",
      text: lang === "kk" ? "Қосымша пікір" : "Дополнительный комментарий",
      description: "",
      options: []
    }
  ];
}

export function AdminPanel({ adminEmail, residents, surveys, analytics }: Props) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [residentRows, setResidentRows] = useState(residents);
  const [surveyRows, setSurveyRows] = useState(surveys);
  const [analyticsRows, setAnalyticsRows] = useState(analytics);
  const [saving, setSaving] = useState(false);
  const [deletingSurveyId, setDeletingSurveyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<SurveyStatus>("DRAFT");
  const [deadline, setDeadline] = useState("");
  const [totalEligible, setTotalEligible] = useState("45");
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => createInitialQuestions(lang));

  const stats = useMemo(() => {
    const totalResidents = residentRows.length;
    const activeResidents = residentRows.filter((row) => row.status === "ACTIVE").length;
    const activeSurveys = surveyRows.filter((row) => row.status === "ACTIVE").length;
    return { totalResidents, activeResidents, activeSurveys };
  }, [residentRows, surveyRows]);

  const activeSurveyRows = useMemo(() => surveyRows.filter((row) => row.status !== "ARCHIVED"), [surveyRows]);
  const visibleAnalyticsRows = useMemo(
    () =>
      analyticsRows.filter((row) =>
        surveyRows.some((survey) => survey.id === row.surveyId && survey.status !== "ARCHIVED")
      ),
    [analyticsRows, surveyRows]
  );

  const logout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/admin/login";
  };

  const updateResident = async (residentId: string, nextStatus: ResidentStatus) => {
    setError(null);
    const response = await fetch(`/api/admin/residents/${residentId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });

    if (!response.ok) {
      setError(t("admin.updateResidentFailed"));
      return;
    }

    setResidentRows((prev) => prev.map((row) => (row.id === residentId ? { ...row, status: nextStatus } : row)));
  };

  const updateSurveyStatus = async (surveyId: string, nextStatus: SurveyStatus) => {
    setError(null);
    const response = await fetch(`/api/admin/surveys/${surveyId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    const payload = (await response.json().catch(() => ({}))) as ApiErrorResponse;

    if (!response.ok) {
      setError(payload.error ?? t("admin.updateSurveyFailed"));
      return;
    }

    setSurveyRows((prev) => prev.map((row) => (row.id === surveyId ? { ...row, status: nextStatus } : row)));
  };

  const deleteSurvey = async (survey: SurveyRow) => {
    setError(null);
    const localizedTitle = decodeLocalizedText(survey.title, lang) ?? survey.title;
    const confirmed = window.confirm(t("admin.deleteSurveyConfirm", { title: localizedTitle }));
    if (!confirmed) {
      return;
    }

    setDeletingSurveyId(survey.id);
    try {
      const response = await fetch(`/api/admin/surveys/${survey.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      const payload = (await response.json().catch(() => ({}))) as ApiErrorResponse;

      if (!response.ok) {
        setError(payload.error ?? t("admin.deleteSurveyFailed"));
        return;
      }

      setSurveyRows((prev) => prev.filter((row) => row.id !== survey.id));
      setAnalyticsRows((prev) => prev.filter((row) => row.surveyId !== survey.id));
    } finally {
      setDeletingSurveyId(null);
    }
  };

  const updateQuestion = (questionId: string, updater: (current: QuestionDraft) => QuestionDraft) => {
    setQuestions((prev) => prev.map((question) => (question.id === questionId ? updater(question) : question)));
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: createDraftId(),
        type: "SINGLE",
        text: "",
        description: "",
        options: ["", ""]
      }
    ]);
  };

  const removeQuestion = (questionId: string) => {
    setQuestions((prev) => prev.filter((question) => question.id !== questionId));
  };

  const addOption = (questionId: string) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      options: [...question.options, ""]
    }));
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      options: question.options.filter((_, index) => index !== optionIndex)
    }));
  };

  const createSurvey = async () => {
    setSaving(true);
    setError(null);

    try {
      const preparedQuestions: NewQuestion[] = [];
      for (const question of questions) {
        const text = question.text.trim();
        const descriptionValue = question.description.trim();

        if (!text) {
          continue;
        }

        if (question.type === "SINGLE") {
          const options = question.options.map((option) => option.trim()).filter(Boolean);
          preparedQuestions.push({
            type: "SINGLE",
            text,
            description: descriptionValue || undefined,
            options
          });
          continue;
        }

        preparedQuestions.push({
          type: question.type,
          text,
          description: descriptionValue || undefined
        });
      }

      if (preparedQuestions.length === 0) {
        setError(t("admin.questionsRequired"));
        return;
      }

      if (preparedQuestions.some((question) => question.type === "SINGLE" && (!question.options || question.options.length < 2))) {
        setError(t("admin.singleNeedTwo"));
        return;
      }

      const response = await fetch("/api/admin/surveys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLang: lang,
          title,
          description,
          status,
          deadline: deadline || null,
          totalEligible: Number(totalEligible),
          questions: preparedQuestions
        })
      });

      const payload = (await response.json().catch(() => ({}))) as CreateSurveyResponse;
      if (!response.ok) {
        setError(payload.error ?? t("admin.createSurveyFailed"));
        return;
      }

      if (!payload.survey) {
        setError(t("admin.missingSurvey"));
        return;
      }

      const createdSurvey = payload.survey;
      setSurveyRows((prev) => [createdSurvey, ...prev]);
      setAnalyticsRows((prev) => [
        {
          surveyId: createdSurvey.id,
          surveyTitle: createdSurvey.title,
          responded: 0,
          totalEligible: createdSurvey.totalEligible,
          percentage: 0
        },
        ...prev
      ]);
      setTitle("");
      setDescription("");
      setDeadline("");
      setQuestions(createInitialQuestions(lang));
    } catch {
      setError(t("admin.invalidQuestionForm"));
    } finally {
      setSaving(false);
    }
  };

  const openSurveyResults = (surveyId: string) => {
    router.push(`/admin/surveys/${surveyId}`);
  };

  return (
    <main className="app-shell space-y-4">
      <section className="glass-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{t("admin.console")}</p>
            <h1 className="text-3xl">{t("admin.operations")}</h1>
            <p className="mt-1 text-sm text-slate-600">{t("admin.signedAs", { email: adminEmail })}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button className="danger-btn" onClick={logout} type="button">
              {t("admin.signOut")}
            </button>
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <p className="text-xs uppercase tracking-[0.1em] text-slate-500">{t("admin.residents")}</p>
          <p className="mt-1 text-3xl font-semibold">{stats.totalResidents}</p>
        </article>
        <article className="kpi-card">
          <p className="text-xs uppercase tracking-[0.1em] text-slate-500">{t("admin.activeResidents")}</p>
          <p className="mt-1 text-3xl font-semibold">{stats.activeResidents}</p>
        </article>
        <article className="kpi-card">
          <p className="text-xs uppercase tracking-[0.1em] text-slate-500">{t("admin.activeSurveys")}</p>
          <p className="mt-1 text-3xl font-semibold">{stats.activeSurveys}</p>
        </article>
      </section>

      {error ? <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{error}</p> : null}

      <section className="glass-panel p-5">
        <h2 className="text-2xl">{t("admin.participation")}</h2>
        <div className="mt-4 space-y-3">
          {visibleAnalyticsRows.map((row) => (
            <div className="rounded-xl border border-slate-200 bg-white p-3" key={row.surveyId}>
              <div className="flex justify-between text-sm">
                <span>{decodeLocalizedText(row.surveyTitle, lang) ?? row.surveyTitle}</span>
                <span>
                  {row.responded}/{row.totalEligible}
                </span>
              </div>
              <div className="mt-2 progress-track">
                <div className="progress-fill" style={{ width: `${row.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel p-5">
        <h2 className="text-2xl">{t("admin.residents")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-slate-600">
                <th className="pb-2">{t("admin.house")}</th>
                <th className="pb-2">{t("admin.phone")}</th>
                <th className="pb-2">{t("admin.votes")}</th>
                <th className="pb-2">{t("admin.status")}</th>
              </tr>
            </thead>
            <tbody>
              {residentRows.map((row) => (
                <tr className="border-b border-slate-200" key={row.id}>
                  <td className="py-2">{row.houseCode}</td>
                  <td className="py-2">{row.phoneNormalized}</td>
                  <td className="py-2">{row.votes}</td>
                  <td className="py-2">
                    <select
                      className="field-select"
                      onChange={(event) => updateResident(row.id, event.target.value as ResidentStatus)}
                      value={row.status}
                    >
                      <option value="ACTIVE">{t("residentStatus.ACTIVE")}</option>
                      <option value="PENDING">{t("residentStatus.PENDING")}</option>
                      <option value="DISABLED">{t("residentStatus.DISABLED")}</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-panel p-5">
        <h2 className="text-2xl">{t("admin.surveys")}</h2>
        <div className="mt-3 space-y-3">
          {activeSurveyRows.map((row) => (
            <article
              className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-blue-300 hover:shadow-[0_0_0_2px_rgba(37,99,235,0.12),0_8px_18px_rgba(15,23,42,0.08)]"
              key={row.id}
              onClick={() => openSurveyResults(row.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openSurveyResults(row.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg">{decodeLocalizedText(row.title, lang) ?? row.title}</h3>
                  <p className="text-xs text-slate-500">
                    {row.voteCount}/{row.totalEligible} {t("admin.votesSuffix")}
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                  <select
                    className="field-select max-w-[180px]"
                    disabled={deletingSurveyId === row.id}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => updateSurveyStatus(row.id, event.target.value as SurveyStatus)}
                    value={row.status}
                  >
                    <option value="ACTIVE">{t("status.active")}</option>
                    <option value="CLOSED">{t("status.closed")}</option>
                    <option value="ARCHIVED">{t("status.archived")}</option>
                  </select>
                  <button
                    className="danger-btn"
                    disabled={deletingSurveyId === row.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteSurvey(row);
                    }}
                    type="button"
                  >
                    {deletingSurveyId === row.id ? t("admin.deletingSurvey") : t("admin.deleteSurvey")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="glass-panel p-5">
        <h2 className="text-2xl">{t("admin.createSurvey")}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="field-label">{t("admin.title")}</label>
            <input className="field-input" onChange={(event) => setTitle(event.target.value)} value={title} />
          </div>
          <div>
            <label className="field-label">{t("admin.status")}</label>
            <select className="field-select" onChange={(event) => setStatus(event.target.value as SurveyStatus)} value={status}>
              <option value="DRAFT">{t("status.draft")}</option>
              <option value="ACTIVE">{t("status.active")}</option>
              <option value="CLOSED">{t("status.closed")}</option>
            </select>
          </div>
          <div>
            <label className="field-label">{t("admin.totalEligible")}</label>
            <input className="field-input" onChange={(event) => setTotalEligible(event.target.value)} type="number" value={totalEligible} />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">{t("admin.description")}</label>
            <textarea className="field-textarea" onChange={(event) => setDescription(event.target.value)} value={description} />
          </div>
          <div>
            <label className="field-label">{t("admin.deadline")}</label>
            <input className="field-input" onChange={(event) => setDeadline(event.target.value)} type="datetime-local" value={deadline} />
          </div>
        </div>

        <div className="mt-5">
          <label className="field-label">{t("admin.questionsBuilder")}</label>
          <div className="space-y-3">
            {questions.map((question, questionIndex) => (
              <div className="rounded-xl border border-slate-200 bg-white p-4" key={question.id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">{t("admin.questionNumber", { index: questionIndex + 1 })}</h3>
                  <button
                    className="secondary-btn"
                    disabled={questions.length === 1}
                    onClick={() => removeQuestion(question.id)}
                    type="button"
                  >
                    {t("admin.removeQuestion")}
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="field-label">{t("admin.questionType")}</label>
                    <select
                      className="field-select"
                      onChange={(event) => {
                        const nextType = event.target.value as QuestionDraft["type"];
                        updateQuestion(question.id, (current) => ({
                          ...current,
                          type: nextType,
                          options: nextType === "SINGLE" ? (current.options.length ? current.options : ["", ""]) : []
                        }));
                      }}
                      value={question.type}
                    >
                      <option value="SINGLE">{t("admin.questionTypeSingle")}</option>
                      <option value="SCALE">{t("admin.questionTypeScale")}</option>
                      <option value="TEXT">{t("admin.questionTypeText")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">{t("admin.questionText")}</label>
                    <input
                      className="field-input"
                      onChange={(event) =>
                        updateQuestion(question.id, (current) => ({
                          ...current,
                          text: event.target.value
                        }))
                      }
                      value={question.text}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="field-label">{t("admin.questionDescription")}</label>
                    <input
                      className="field-input"
                      onChange={(event) =>
                        updateQuestion(question.id, (current) => ({
                          ...current,
                          description: event.target.value
                        }))
                      }
                      value={question.description}
                    />
                  </div>
                </div>

                {question.type === "SINGLE" ? (
                  <div className="mt-3 space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <div className="flex flex-wrap items-center gap-2" key={`${question.id}-option-${optionIndex}`}>
                        <input
                          className="field-input flex-1"
                          onChange={(event) =>
                            updateQuestion(question.id, (current) => ({
                              ...current,
                              options: current.options.map((value, index) => (index === optionIndex ? event.target.value : value))
                            }))
                          }
                          placeholder={t("admin.optionText")}
                          value={option}
                        />
                        <button
                          className="secondary-btn"
                          disabled={question.options.length <= 2}
                          onClick={() => removeOption(question.id, optionIndex)}
                          type="button"
                        >
                          {t("admin.removeOption")}
                        </button>
                      </div>
                    ))}
                    <button className="secondary-btn" onClick={() => addOption(question.id)} type="button">
                      {t("admin.addOption")}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}

            <button className="secondary-btn" onClick={addQuestion} type="button">
              {t("admin.addQuestion")}
            </button>
          </div>
        </div>

        <button className="primary-btn mt-4" disabled={saving} onClick={createSurvey} type="button">
          {saving ? t("admin.creating") : t("admin.create")}
        </button>
      </section>
    </main>
  );
}
