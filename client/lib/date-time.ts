import type { Lang } from "@/lib/i18n";

const LOCALE_BY_LANG: Record<Lang, string> = {
  kk: "kk-KZ",
  ru: "ru-RU"
};

export function formatLocalizedDateTime(value: string, lang: Lang): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(LOCALE_BY_LANG[lang], {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
}
