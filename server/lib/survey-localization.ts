import type { QuestionType } from "@prisma/client";

import { createLocalizedText } from "@/lib/localized-text";
import type { Lang } from "@/lib/i18n";
import { translateBatch } from "@/lib/translation";

type SurveyQuestionInput = {
  type: QuestionType;
  text: string;
  description?: string;
  options?: string[];
};

type LocalizedQuestion = {
  type: QuestionType;
  text: string;
  description?: string;
  options?: string[];
};

type LocalizeSurveyInput = {
  sourceLang: Lang;
  title: string;
  description?: string;
  questions: SurveyQuestionInput[];
};

function oppositeLang(lang: Lang): Lang {
  return lang === "kk" ? "ru" : "kk";
}

type TextRef = {
  value: string;
};

function pushText(refs: TextRef[], value: string | null | undefined): number | null {
  const prepared = value?.trim();
  if (!prepared) {
    return null;
  }
  refs.push({ value: prepared });
  return refs.length - 1;
}

function localizeAtIndex(input: { sourceLang: Lang; refs: TextRef[]; translated: string[]; index: number | null }): string | undefined {
  if (input.index == null) {
    return undefined;
  }

  const sourceText = input.refs[input.index]?.value;
  if (!sourceText) {
    return undefined;
  }

  const translatedText = input.translated[input.index] ?? sourceText;
  return createLocalizedText(sourceText, input.sourceLang, translatedText);
}

export async function localizeSurveyContent(input: LocalizeSurveyInput): Promise<{
  title: string;
  description?: string;
  questions: LocalizedQuestion[];
}> {
  const refs: TextRef[] = [];

  const titleIndex = pushText(refs, input.title);
  const descriptionIndex = pushText(refs, input.description);

  const questionRefs = input.questions.map((question) => ({
    textIndex: pushText(refs, question.text),
    descriptionIndex: pushText(refs, question.description),
    optionIndexes: (question.options ?? []).map((option) => pushText(refs, option))
  }));

  const translated = await translateBatch({
    texts: refs.map((entry) => entry.value),
    sourceLang: input.sourceLang,
    targetLang: oppositeLang(input.sourceLang)
  });

  const localizedTitle = localizeAtIndex({
    sourceLang: input.sourceLang,
    refs,
    translated,
    index: titleIndex
  });

  if (!localizedTitle) {
    throw new Error("Localized title was not produced.");
  }

  const localizedDescription = localizeAtIndex({
    sourceLang: input.sourceLang,
    refs,
    translated,
    index: descriptionIndex
  });

  const localizedQuestions = input.questions.map((question, index) => {
    const ref = questionRefs[index];
    const localizedText = localizeAtIndex({
      sourceLang: input.sourceLang,
      refs,
      translated,
      index: ref.textIndex
    });

    if (!localizedText) {
      throw new Error(`Localized question text missing for question index ${index}.`);
    }

    return {
      type: question.type,
      text: localizedText,
      description: localizeAtIndex({
        sourceLang: input.sourceLang,
        refs,
        translated,
        index: ref.descriptionIndex
      }),
      options: (question.options ?? [])
        .map((_, optionIndex) =>
          localizeAtIndex({
            sourceLang: input.sourceLang,
            refs,
            translated,
            index: ref.optionIndexes[optionIndex]
          })
        )
        .filter((value): value is string => Boolean(value))
    };
  });

  return {
    title: localizedTitle,
    description: localizedDescription,
    questions: localizedQuestions
  };
}

export async function localizeSurveyTextPatch(input: {
  sourceLang: Lang;
  title?: string;
  description?: string | null;
}): Promise<{ title?: string; description?: string | null }> {
  const refs: TextRef[] = [];
  const titleIndex = input.title === undefined ? null : pushText(refs, input.title);
  const descriptionIndex = input.description === undefined || input.description === null ? null : pushText(refs, input.description);

  const translated = await translateBatch({
    texts: refs.map((entry) => entry.value),
    sourceLang: input.sourceLang,
    targetLang: oppositeLang(input.sourceLang)
  });

  const title =
    input.title === undefined
      ? undefined
      : localizeAtIndex({
          sourceLang: input.sourceLang,
          refs,
          translated,
          index: titleIndex
        }) ?? input.title.trim();

  const description =
    input.description === undefined
      ? undefined
      : input.description === null
        ? null
        : localizeAtIndex({
            sourceLang: input.sourceLang,
            refs,
            translated,
            index: descriptionIndex
          }) ?? input.description.trim();

  return { title, description };
}
