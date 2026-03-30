import { Prisma } from "@prisma/client";

import { env } from "../lib/env";
import { encodeLocalizedText, isLocalizedText } from "../lib/localized-text";
import { prisma } from "../lib/prisma";
import { translateBatch } from "../lib/translation";

type SourceLang = "en" | "kk" | "ru";

type TextRef =
  | { kind: "survey-title"; surveyId: string; text: string }
  | { kind: "survey-description"; surveyId: string; text: string }
  | { kind: "question-text"; questionId: string; text: string }
  | { kind: "question-description"; questionId: string; text: string }
  | { kind: "option-label"; optionId: string; text: string };

function getSourceLang(): SourceLang {
  const raw = (process.env.SURVEY_SOURCE_LANG ?? "en").toLowerCase();
  if (raw === "en" || raw === "kk" || raw === "ru") {
    return raw;
  }

  throw new Error('SURVEY_SOURCE_LANG must be one of: "en", "kk", "ru".');
}

function fallback(value: string | undefined, original: string): string {
  return value?.trim() ? value.trim() : original;
}

async function translateToKkAndRu(sourceLang: SourceLang, texts: string[]): Promise<{ kk: string[]; ru: string[] }> {
  if (sourceLang === "kk") {
    return {
      kk: texts,
      ru: await translateBatch({ texts, sourceLang: "kk", targetLang: "ru" })
    };
  }

  if (sourceLang === "ru") {
    return {
      kk: await translateBatch({ texts, sourceLang: "ru", targetLang: "kk" }),
      ru: texts
    };
  }

  return {
    kk: await translateBatch({ texts, sourceLang: "en", targetLang: "kk" }),
    ru: await translateBatch({ texts, sourceLang: "en", targetLang: "ru" })
  };
}

async function main() {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for backfill translation.");
  }

  const sourceLang = getSourceLang();

  const surveys = await prisma.survey.findMany({
    include: {
      questions: {
        include: {
          options: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  let surveysTouched = 0;
  let fieldsLocalized = 0;

  for (const survey of surveys) {
    const refs: TextRef[] = [];

    if (!isLocalizedText(survey.title)) {
      refs.push({ kind: "survey-title", surveyId: survey.id, text: survey.title });
    }

    if (survey.description && !isLocalizedText(survey.description)) {
      refs.push({ kind: "survey-description", surveyId: survey.id, text: survey.description });
    }

    for (const question of survey.questions) {
      if (!isLocalizedText(question.text)) {
        refs.push({ kind: "question-text", questionId: question.id, text: question.text });
      }

      if (question.description && !isLocalizedText(question.description)) {
        refs.push({ kind: "question-description", questionId: question.id, text: question.description });
      }

      for (const option of question.options) {
        if (!isLocalizedText(option.label)) {
          refs.push({ kind: "option-label", optionId: option.id, text: option.label });
        }
      }
    }

    if (refs.length === 0) {
      continue;
    }

    const sourceTexts = refs.map((ref) => ref.text.trim());
    const translated = await translateToKkAndRu(sourceLang, sourceTexts);

    const surveyUpdate: { title?: string; description?: string } = {};
    const questionUpdates = new Map<string, { text?: string; description?: string }>();
    const optionUpdates = new Map<string, { label?: string }>();

    refs.forEach((ref, index) => {
      const kk = fallback(translated.kk[index], ref.text);
      const ru = fallback(translated.ru[index], ref.text);
      const localized = encodeLocalizedText({ kk, ru });

      if (ref.kind === "survey-title") {
        surveyUpdate.title = localized;
        return;
      }

      if (ref.kind === "survey-description") {
        surveyUpdate.description = localized;
        return;
      }

      if (ref.kind === "question-text") {
        const previous = questionUpdates.get(ref.questionId) ?? {};
        questionUpdates.set(ref.questionId, { ...previous, text: localized });
        return;
      }

      if (ref.kind === "question-description") {
        const previous = questionUpdates.get(ref.questionId) ?? {};
        questionUpdates.set(ref.questionId, { ...previous, description: localized });
        return;
      }

      const previous = optionUpdates.get(ref.optionId) ?? {};
      optionUpdates.set(ref.optionId, { ...previous, label: localized });
    });

    const operations: Prisma.PrismaPromise<unknown>[] = [];

    if (surveyUpdate.title || surveyUpdate.description) {
      operations.push(
        prisma.survey.update({
          where: { id: survey.id },
          data: surveyUpdate
        })
      );
    }

    for (const [questionId, data] of questionUpdates) {
      operations.push(
        prisma.question.update({
          where: { id: questionId },
          data
        })
      );
    }

    for (const [optionId, data] of optionUpdates) {
      operations.push(
        prisma.surveyOption.update({
          where: { id: optionId },
          data
        })
      );
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
      surveysTouched += 1;
      fieldsLocalized += refs.length;
    }
  }

  console.log(`Localized ${fieldsLocalized} text fields across ${surveysTouched} surveys.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
