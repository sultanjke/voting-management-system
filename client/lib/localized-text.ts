import type { Lang } from "@/lib/i18n";

const LOCALIZED_PREFIX = "__rv_i18n__:";

type LocalizedMap = Record<Lang, string>;

export function encodeLocalizedText(value: LocalizedMap): string {
  return `${LOCALIZED_PREFIX}${JSON.stringify(value)}`;
}

export function isLocalizedText(raw: string | null | undefined): boolean {
  return typeof raw === "string" && raw.startsWith(LOCALIZED_PREFIX);
}

export function parseLocalizedText(raw: string): LocalizedMap | null {
  if (!raw.startsWith(LOCALIZED_PREFIX)) {
    return null;
  }

  const json = raw.slice(LOCALIZED_PREFIX.length);
  try {
    const parsed = JSON.parse(json) as Partial<LocalizedMap>;
    const kk = typeof parsed.kk === "string" ? parsed.kk : null;
    const ru = typeof parsed.ru === "string" ? parsed.ru : null;
    if (!kk || !ru) {
      return null;
    }
    return { kk, ru };
  } catch {
    return null;
  }
}

export function decodeLocalizedText(raw: string | null | undefined, lang: Lang): string | null {
  if (raw == null) {
    return null;
  }

  const parsed = parseLocalizedText(raw);
  if (!parsed) {
    return raw;
  }

  return parsed[lang] ?? parsed.kk;
}

export function createLocalizedText(sourceText: string, sourceLang: Lang, translatedText: string): string {
  const source = sourceText.trim();
  const translated = translatedText.trim() || source;

  if (sourceLang === "kk") {
    return encodeLocalizedText({ kk: source, ru: translated });
  }

  return encodeLocalizedText({ kk: translated, ru: source });
}
