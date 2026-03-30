"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { QuestionType, SurveyStatus } from "@shared/contracts";

import { useI18n } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { formatLocalizedDateTime } from "@/lib/date-time";
import { decodeLocalizedText } from "@/lib/localized-text";

type Question = {
  id: string;
  type: QuestionType;
  text: string;
  description: string | null;
  position: number;
  options: Array<{ id: string; label: string; position: number }>;
};

type Props = {
  surveyId: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  deadline: string | null;
  alreadyVoted: boolean;
  questions: Question[];
};

type AnswerState = Record<string, { optionId?: string; scaleValue?: number; textValue?: string }>;

export function SurveyRunner({ surveyId, title, description, status, deadline, alreadyVoted, questions }: Props) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formattedDeadline = deadline ? formatLocalizedDateTime(deadline, lang) : null;
  const localizedTitle = decodeLocalizedText(title, lang) ?? title;
  const localizedDescription = decodeLocalizedText(description, lang);
  const localizedQuestions = useMemo(
    () =>
      questions.map((question) => ({
        ...question,
        text: decodeLocalizedText(question.text, lang) ?? question.text,
        description: decodeLocalizedText(question.description, lang),
        options: question.options.map((option) => ({
          ...option,
          label: decodeLocalizedText(option.label, lang) ?? option.label
        }))
      })),
    [lang, questions]
  );

  const currentQuestion = localizedQuestions[index];
  const progress = useMemo(() => {
    if (questions.length === 0) {
      return 0;
    }
    return Math.round(((index + 1) / questions.length) * 100);
  }, [index, questions.length]);

  if (alreadyVoted) {
    return (
      <main className="app-shell">
        <section className="glass-panel p-6">
          <h1 className="text-3xl">{t("survey.alreadyRecordedTitle")}</h1>
          <p className="mt-2 text-sm text-slate-600">{t("survey.alreadyRecordedDesc")}</p>
          <div className="mt-5">
            <Link className="secondary-btn" href="/">
              {t("survey.backToDashboard")}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (status !== "ACTIVE") {
    return (
      <main className="app-shell">
        <section className="glass-panel p-6">
          <h1 className="text-3xl">{t("survey.closedTitle")}</h1>
          <p className="mt-2 text-sm text-slate-600">{t("survey.closedDesc")}</p>
          <div className="mt-5">
            <Link className="secondary-btn" href="/">
              {t("survey.backToDashboard")}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        answers: questions.map((question) => ({
          questionId: question.id,
          optionId: answers[question.id]?.optionId,
          scaleValue: answers[question.id]?.scaleValue,
          textValue: answers[question.id]?.textValue
        }))
      };

      const response = await fetch(`/api/resident/surveys/${surveyId}/vote`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        setError(t("survey.submitError"));
        return;
      }

      router.push("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="app-shell space-y-4">
      <section className="glass-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{t("survey.session")}</p>
            <h1 className="mt-1 text-3xl">{localizedTitle}</h1>
            {localizedDescription ? <p className="mt-2 text-sm text-slate-600">{localizedDescription}</p> : null}
            {formattedDeadline ? (
              <p className="mt-1 text-sm text-slate-600">
                {t("survey.deadline")}: <strong>{formattedDeadline}</strong>
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link className="secondary-btn" href="/">
              {t("survey.exit")}
            </Link>
          </div>
        </div>
      </section>

      <section className="glass-panel p-5">
        <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
          <span>{t("survey.progress", { current: index + 1, total: questions.length })}</span>
          <span>{progress}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-5">
          <h2 className="text-2xl">{currentQuestion.text}</h2>
          {currentQuestion.description ? <p className="mt-1 text-sm text-slate-600">{currentQuestion.description}</p> : null}
        </div>

        <div className="mt-4 space-y-3">
          {currentQuestion.type === "SINGLE"
            ? currentQuestion.options.map((option) => (
                <button
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    answers[currentQuestion.id]?.optionId === option.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-300 bg-white hover:border-blue-300"
                  }`}
                  key={option.id}
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [currentQuestion.id]: {
                        ...prev[currentQuestion.id],
                        optionId: option.id
                      }
                    }))
                  }
                  type="button"
                >
                  {option.label}
                </button>
              ))
            : null}

          {currentQuestion.type === "SCALE" ? (
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  className={`rounded-xl border px-2 py-3 text-center font-semibold transition ${
                    answers[currentQuestion.id]?.scaleValue === score
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-300 bg-white hover:border-blue-300"
                  }`}
                  key={score}
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [currentQuestion.id]: {
                        ...prev[currentQuestion.id],
                        scaleValue: score
                      }
                    }))
                  }
                  type="button"
                >
                  {score}
                </button>
              ))}
            </div>
          ) : null}

          {currentQuestion.type === "TEXT" ? (
            <textarea
              className="field-textarea"
              onChange={(event) =>
                setAnswers((prev) => ({
                  ...prev,
                  [currentQuestion.id]: {
                    ...prev[currentQuestion.id],
                    textValue: event.target.value
                  }
                }))
              }
              placeholder={t("survey.textPlaceholder")}
              value={answers[currentQuestion.id]?.textValue ?? ""}
            />
          ) : null}
        </div>

        {error ? <p className="mt-4 rounded-xl bg-blue-50 p-2 text-sm text-blue-800">{error}</p> : null}

        <div className="mt-5 flex flex-wrap justify-between gap-2">
          <button className="secondary-btn" disabled={index === 0 || submitting} onClick={() => setIndex((value) => value - 1)} type="button">
            {t("survey.previous")}
          </button>
          {index < questions.length - 1 ? (
            <button className="primary-btn" disabled={submitting} onClick={() => setIndex((value) => value + 1)} type="button">
              {t("survey.next")}
            </button>
          ) : (
            <button className="primary-btn" disabled={submitting} onClick={submit} type="button">
              {submitting ? t("survey.submitting") : t("survey.submitVote")}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

