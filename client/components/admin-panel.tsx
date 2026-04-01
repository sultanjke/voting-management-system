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

type CreateResidentResponse = {
  resident?: ResidentRow;
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

type BuilderStep = 1 | 2 | 3;
type QuestionTemplate = "SINGLE" | "SCALE" | "TEXT";

function createDraftId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function createInitialQuestions(): QuestionDraft[] {
  return [];
}

function createQuestionFromTemplate(template: QuestionTemplate, lang: "kk" | "ru"): QuestionDraft {
  if (template === "SINGLE") {
    return {
      id: createDraftId(),
      type: "SINGLE",
      text: "",
      description: "",
      options:
        lang === "kk"
          ? ["Нұсқа 1", "Нұсқа 2", "Нұсқа 3"]
          : ["Вариант 1", "Вариант 2", "Вариант 3"]
    };
  }

  if (template === "SCALE") {
    return {
      id: createDraftId(),
      type: "SCALE",
      text: "",
      description: lang === "kk" ? "1 = төмен, 5 = жоғары" : "1 = низко, 5 = высоко",
      options: []
    };
  }

  return {
    id: createDraftId(),
    type: "TEXT",
    text: "",
    description: "",
    options: []
  };
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
  const [createError, setCreateError] = useState<string | null>(null);
  const [addingResident, setAddingResident] = useState(false);
  const [newResidentPhone, setNewResidentPhone] = useState("");
  const [newResidentHouseCode, setNewResidentHouseCode] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<SurveyStatus>("ACTIVE");
  const [deadline, setDeadline] = useState("");
  const [totalEligible, setTotalEligible] = useState("40");
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => createInitialQuestions());
  const [builderStep, setBuilderStep] = useState<BuilderStep>(1);
  const [showArchivedSurveys, setShowArchivedSurveys] = useState(false);

  const stats = useMemo(() => {
    const totalResidents = residentRows.length;
    const activeResidents = residentRows.filter((row) => row.status === "ACTIVE").length;
    const activeSurveys = surveyRows.filter((row) => row.status === "ACTIVE").length;
    return { totalResidents, activeResidents, activeSurveys };
  }, [residentRows, surveyRows]);

  const activeSurveyRows = useMemo(() => surveyRows.filter((row) => row.status !== "ARCHIVED"), [surveyRows]);
  const archivedSurveyRows = useMemo(() => surveyRows.filter((row) => row.status === "ARCHIVED"), [surveyRows]);
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

  const createResident = async () => {
    setError(null);
    setAddingResident(true);

    try {
      const response = await fetch("/api/admin/residents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: newResidentPhone,
          houseCode: newResidentHouseCode
        })
      });
      const payload = (await response.json().catch(() => ({}))) as CreateResidentResponse;

      if (!response.ok || !payload.resident) {
        setError(payload.error ?? t("admin.createResidentFailed"));
        return;
      }

      setResidentRows((prev) => [payload.resident!, ...prev]);
      setNewResidentPhone("");
      setNewResidentHouseCode("");
    } finally {
      setAddingResident(false);
    }
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

  const addQuestion = (template: QuestionTemplate) => {
    setCreateError(null);
    setQuestions((prev) => [...prev, createQuestionFromTemplate(template, lang)]);
  };

  const removeQuestion = (questionId: string) => {
    setCreateError(null);
    setQuestions((prev) => prev.filter((question) => question.id !== questionId));
  };

  const addOption = (questionId: string) => {
    setCreateError(null);
    updateQuestion(questionId, (question) => ({
      ...question,
      options: [...question.options, ""]
    }));
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    setCreateError(null);
    updateQuestion(questionId, (question) => ({
      ...question,
      options: question.options.filter((_, index) => index !== optionIndex)
    }));
  };

  const prepareQuestions = (): NewQuestion[] => {
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

    return preparedQuestions;
  };

  const validateDetailsStep = (): string | null => {
    if (!title.trim()) {
      return t("admin.validationTitleRequired");
    }

    const eligible = Number(totalEligible);
    if (!Number.isFinite(eligible) || eligible <= 0) {
      return t("admin.validationEligiblePositive");
    }

    return null;
  };

  const validateQuestionsStep = (preparedQuestions: NewQuestion[]): string | null => {
    if (preparedQuestions.length === 0) {
      return t("admin.validationQuestionRequired");
    }

    if (preparedQuestions.some((question) => question.type === "SINGLE" && (!question.options || question.options.length < 2))) {
      return t("admin.validationSingleOptions");
    }

    return null;
  };

  const goToNextBuilderStep = () => {
    setCreateError(null);

    if (builderStep === 1) {
      const detailsError = validateDetailsStep();
      if (detailsError) {
        setCreateError(detailsError);
        return;
      }
      setBuilderStep(2);
      return;
    }

    if (builderStep === 2) {
      const preparedQuestions = prepareQuestions();
      const questionsError = validateQuestionsStep(preparedQuestions);
      if (questionsError) {
        setCreateError(questionsError);
        return;
      }
      setBuilderStep(3);
    }
  };

  const goToPreviousBuilderStep = () => {
    setCreateError(null);
    if (builderStep === 2) {
      setBuilderStep(1);
      return;
    }
    if (builderStep === 3) {
      setBuilderStep(2);
    }
  };

  const createSurvey = async () => {
    setSaving(true);
    setError(null);
    setCreateError(null);

    try {
      const detailsError = validateDetailsStep();
      if (detailsError) {
        setCreateError(detailsError);
        setBuilderStep(1);
        return;
      }

      const preparedQuestions = prepareQuestions();
      const questionsError = validateQuestionsStep(preparedQuestions);
      if (questionsError) {
        setCreateError(questionsError);
        setBuilderStep(2);
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
      setStatus("ACTIVE");
      setDeadline("");
      setQuestions(createInitialQuestions());
      setBuilderStep(1);
    } catch {
      setCreateError(t("admin.invalidQuestionForm"));
    } finally {
      setSaving(false);
    }
  };

  const openSurveyResults = (surveyId: string) => {
    router.push(`/admin/surveys/${surveyId}`);
  };

  const renderSurveyCard = (row: SurveyRow, archivedView = false) => (
    <article
      className={`rounded-xl border border-slate-200 bg-white p-3 transition hover:border-blue-300 hover:shadow-[0_0_0_2px_rgba(37,99,235,0.12),0_8px_18px_rgba(15,23,42,0.08)] ${
        archivedView ? "opacity-90" : ""
      }`}
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
            className="destructive-btn"
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
  );

  const reviewedQuestions = prepareQuestions();

  return (
    <main className="app-shell space-y-4">
      <section className="glass-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{t("admin.console")}</p>
            <h1 className="text-3xl mb-3 mt-3">🕹️ {t("admin.operations")}</h1>
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
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <div>
            <label className="field-label">{t("admin.addResidentPhone")}</label>
            <input
              className="field-input"
              onChange={(event) => setNewResidentPhone(event.target.value)}
              placeholder="+7 777 123 4567"
              value={newResidentPhone}
            />
          </div>
          <div>
            <label className="field-label">{t("admin.addResidentHouse")}</label>
            <input
              className="field-input"
              onChange={(event) => setNewResidentHouseCode(event.target.value)}
              placeholder="1"
              value={newResidentHouseCode}
            />
          </div>
          <div className="flex items-end">
            <button
              className="primary-btn w-full md:w-auto"
              disabled={addingResident || !newResidentPhone.trim() || !newResidentHouseCode.trim()}
              onClick={createResident}
              type="button"
            >
              {addingResident ? t("admin.addingResident") : t("admin.addResident")}
            </button>
          </div>
        </div>
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl">{t("admin.surveys")}</h2>
          <button
            className="secondary-btn"
            onClick={() => setShowArchivedSurveys((previous) => !previous)}
            type="button"
          >
            {showArchivedSurveys
              ? t("admin.hideArchived", { count: archivedSurveyRows.length })
              : t("admin.showArchived", { count: archivedSurveyRows.length })}
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {activeSurveyRows.map((row) => renderSurveyCard(row))}
        </div>

        {showArchivedSurveys ? (
          <div className="mt-4 space-y-3">
            {archivedSurveyRows.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                {t("admin.noArchivedSurveys")}
              </p>
            ) : (
              archivedSurveyRows.map((row) => renderSurveyCard(row, true))
            )}
          </div>
        ) : null}
      </section>

      <section className="glass-panel p-5">
        <h2 className="text-2xl">{t("admin.createSurvey")}</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {(
            [
              [1, t("admin.builder.stepDetails")],
              [2, t("admin.builder.stepQuestions")],
              [3, t("admin.builder.stepReview")]
            ] as const
          ).map(([step, label]) => (
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                builderStep === step
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
              key={step}
            >
              {label}
            </div>
          ))}
        </div>

        {createError ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</p> : null}

        {builderStep === 1 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="field-label">{t("admin.title")}</label>
              <input
                className="field-input"
                onChange={(event) => {
                  setCreateError(null);
                  setTitle(event.target.value);
                }}
                value={title}
              />
            </div>
            <div>
              <label className="field-label">{t("admin.status")}</label>
              <select
                className="field-select"
                onChange={(event) => {
                  setCreateError(null);
                  setStatus(event.target.value as SurveyStatus);
                }}
                value={status}
              >
                <option value="ACTIVE">{t("status.active")}</option>
                <option value="CLOSED">{t("status.closed")}</option>
              </select>
            </div>
            <div>
              <label className="field-label">{t("admin.totalEligible")}</label>
              <input
                className="field-input"
                onChange={(event) => {
                  setCreateError(null);
                  setTotalEligible(event.target.value);
                }}
                type="number"
                value={totalEligible}
              />
            </div>
            <div className="md:col-span-2">
              <label className="field-label">{t("admin.description")}</label>
              <textarea
                className="field-textarea"
                onChange={(event) => {
                  setCreateError(null);
                  setDescription(event.target.value);
                }}
                value={description}
              />
            </div>
            <div>
              <label className="field-label">{t("admin.deadline")}</label>
              <input
                className="field-input"
                onChange={(event) => {
                  setCreateError(null);
                  setDeadline(event.target.value);
                }}
                type="datetime-local"
                value={deadline}
              />
            </div>
          </div>
        ) : null}

        {builderStep === 2 ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="field-label">{t("admin.builder.templateTitle")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="secondary-btn" onClick={() => addQuestion("SINGLE")} type="button">
                  {t("admin.builder.templateSingle")}
                </button>
                <button className="secondary-btn" onClick={() => addQuestion("SCALE")} type="button">
                  {t("admin.builder.templateScale")}
                </button>
                <button className="secondary-btn" onClick={() => addQuestion("TEXT")} type="button">
                  {t("admin.builder.templateText")}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {questions.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                  {t("admin.builder.noQuestions")}
                </p>
              ) : null}

              {questions.map((question, questionIndex) => (
                <article className="rounded-xl border border-slate-200 bg-white p-4" key={question.id}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">{t("admin.questionNumber", { index: questionIndex + 1 })}</h3>
                    <button className="destructive-btn" onClick={() => removeQuestion(question.id)} type="button">
                      {t("admin.builder.deleteQuestion")}
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="field-label">{t("admin.questionType")}</label>
                      <select
                        className="field-select"
                        onChange={(event) => {
                          setCreateError(null);
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
                        onChange={(event) => {
                          setCreateError(null);
                          updateQuestion(question.id, (current) => ({
                            ...current,
                            text: event.target.value
                          }));
                        }}
                        value={question.text}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="field-label">{t("admin.questionDescription")}</label>
                      <input
                        className="field-input"
                        onChange={(event) => {
                          setCreateError(null);
                          updateQuestion(question.id, (current) => ({
                            ...current,
                            description: event.target.value
                          }));
                        }}
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
                            onChange={(event) => {
                              setCreateError(null);
                              updateQuestion(question.id, (current) => ({
                                ...current,
                                options: current.options.map((value, index) =>
                                  index === optionIndex ? event.target.value : value
                                )
                              }));
                            }}
                            placeholder={t("admin.optionText")}
                            value={option}
                          />
                          <button
                            className="destructive-btn"
                            disabled={question.options.length <= 2}
                            onClick={() => removeOption(question.id, optionIndex)}
                            type="button"
                          >
                            {t("admin.builder.removeOption")}
                          </button>
                        </div>
                      ))}
                      <button className="secondary-btn" onClick={() => addOption(question.id)} type="button">
                        {t("admin.addOption")}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {builderStep === 3 ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-base font-semibold">{t("admin.builder.reviewDetails")}</h3>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                <p>
                  {t("admin.title")}: <strong className="text-slate-900">{title || "-"}</strong>
                </p>
                <p>
                  {t("admin.status")}:{" "}
                  <strong className="text-slate-900">
                    {status === "CLOSED" ? t("status.closed") : t("status.active")}
                  </strong>
                </p>
                <p>
                  {t("admin.totalEligible")}: <strong className="text-slate-900">{totalEligible || "-"}</strong>
                </p>
                <p>
                  {t("admin.deadline")}: <strong className="text-slate-900">{deadline || "-"}</strong>
                </p>
                <p className="md:col-span-2">
                  {t("admin.description")}: <strong className="text-slate-900">{description.trim() || "-"}</strong>
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-base font-semibold">{t("admin.builder.reviewQuestions")}</h3>
              <div className="mt-3 space-y-3">
                {reviewedQuestions.length === 0 ? (
                  <p className="text-sm text-slate-600">{t("admin.builder.noQuestions")}</p>
                ) : null}
                {reviewedQuestions.map((question, questionIndex) => (
                  <div className="rounded-lg border border-slate-200 px-3 py-2" key={`${question.type}-${questionIndex}`}>
                    <p className="text-sm font-semibold text-slate-900">
                      {t("admin.questionNumber", { index: questionIndex + 1 })}: {question.text}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {question.type === "SINGLE"
                        ? t("admin.questionTypeSingle")
                        : question.type === "SCALE"
                          ? t("admin.questionTypeScale")
                          : t("admin.questionTypeText")}
                    </p>
                    {question.description ? <p className="mt-1 text-sm text-slate-600">{question.description}</p> : null}
                    {question.type === "SINGLE" ? (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
                        {(question.options ?? []).map((option, optionIndex) => (
                          <li key={`${option}-${optionIndex}`}>{option}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button
            className="secondary-btn"
            disabled={builderStep === 1 || saving}
            onClick={goToPreviousBuilderStep}
            type="button"
          >
            {t("admin.builder.previous")}
          </button>

          {builderStep < 3 ? (
            <button className="primary-btn" disabled={saving} onClick={goToNextBuilderStep} type="button">
              {builderStep === 2 ? t("admin.builder.review") : t("admin.builder.next")}
            </button>
          ) : (
            <button className="primary-btn" disabled={saving} onClick={createSurvey} type="button">
              {saving ? t("admin.creating") : t("admin.create")}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
