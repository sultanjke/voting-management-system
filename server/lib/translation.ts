import { env } from "@/lib/env";
import type { Lang } from "@/lib/i18n";

const OPENAI_TRANSLATION_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_TRANSLATION_MODEL = "gpt-4.1-mini";

export type TranslationSourceLang = Lang | "en" | "auto";

function safeParseTranslations(raw: unknown, fallback: string[]): string[] {
  if (typeof raw !== "string") {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) => (typeof item === "string" && item.trim() ? item.trim() : fallback[index]));
    }

    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { translations?: unknown[] }).translations)) {
      const translations = (parsed as { translations: unknown[] }).translations;
      return fallback.map((value, index) => {
        const candidate = translations[index];
        return typeof candidate === "string" && candidate.trim() ? candidate.trim() : value;
      });
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export async function translateBatch(input: { texts: string[]; sourceLang: TranslationSourceLang; targetLang: Lang }): Promise<string[]> {
  const prepared = input.texts.map((text) => text.trim());
  if (prepared.length === 0 || input.sourceLang === input.targetLang) {
    return prepared;
  }

  if (!env.OPENAI_API_KEY) {
    return prepared;
  }

  const model = env.OPENAI_TRANSLATION_MODEL || DEFAULT_TRANSLATION_MODEL;
  const systemPrompt =
    "You are a professional translator for civic survey software. Translate each input string precisely. Keep tone neutral and concise. Return only JSON.";
  const userPrompt = JSON.stringify(
    {
      sourceLang: input.sourceLang,
      targetLang: input.targetLang,
      texts: prepared,
      format: { translations: ["translated_text_1", "translated_text_2"] }
    },
    null,
    2
  );

  try {
    const response = await fetch(OPENAI_TRANSLATION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      return prepared;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    return safeParseTranslations(content, prepared);
  } catch {
    return prepared;
  }
}
