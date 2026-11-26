// i18n.ts: the languages, named in this one place. A further language is its file in src/i18n/ and its line in
// LANGUAGES; i18n.test.ts fails while it lacks a key. Every word the app shows stands in those files (ESLint forbids
// words in JSX); numbers and dates come from lib/format.ts by the same language.
import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { name } from "../sebaro.product.json";
import de from "./i18n/de.json";
import en from "./i18n/en.json";

type Language = {
  /** the language's own name, as the choice in „Mehr“ shows it */
  name: string;
  /** the locale Intl formats numbers and dates with */
  locale: string;
  /** dates as 2026-10-10 instead of the locale's own order */
  isoDate?: boolean;
  words: typeof de;
};

const table = {
  de: { name: "Deutsch", locale: "de-DE", words: de },
  en: { name: "English", locale: "en-US", isoDate: true, words: en },
} satisfies Record<string, Language>;

export type Lang = keyof typeof table;
export const LANGUAGES: Record<Lang, Language> = table;

declare module "i18next" {
  interface CustomTypeOptions {
    resources: { translation: typeof de };
  }
}

const isLang = (value: string): value is Lang => value in LANGUAGES;

// theme-init.js has put the stored choice (sb-lang) into <html lang> before the first paint
const start = document.documentElement.lang;

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(LANGUAGES).map(([lang, { words }]) => [lang, { translation: words }])),
  lng: isLang(start) ? start : "de",
  fallbackLng: "de",
  initAsync: false,
  // {{app}} in any string is the product's name, from sebaro.product.json
  interpolation: { escapeValue: false, defaultVariables: { app: name } },
});

i18n.on("languageChanged", (lang) => {
  document.documentElement.lang = lang;
  try {
    localStorage.setItem("sb-lang", lang);
  } catch {
    // storage blocked: the choice holds until the page closes
  }
});

/** The language of the page, for lib/format.ts. */
export function useLang(): Lang {
  const { i18n: instance } = useTranslation();
  return isLang(instance.language) ? instance.language : "de";
}

export default i18n;
