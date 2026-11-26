// format.ts: numbers and dates by the page's language. Everything goes through Intl with the locale src/i18n.ts
// names, then one rule: between a number and its unit stands U+00A0, never U+202F or U+2009 (some Intl outputs use
// those).
import { LANGUAGES, type Lang } from "../i18n";

const NBSP = "\u00a0";
const clean = (s: string) => s.replace(/[\u202f\u2009]/g, NBSP);

/** 10.000 (de) / 10,000 (en) */
export function num(lang: Lang, n: number): string {
  return clean(new Intl.NumberFormat(LANGUAGES[lang].locale).format(n));
}

/** a point in time as this device's clock shows it, in 24 hours in every language: 01:00 */
export function clock(lang: Lang, at: number): string {
  const options = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;
  return clean(new Intl.DateTimeFormat(LANGUAGES[lang].locale, options).format(new Date(at)));
}

/** whether a point in time lies on a later day of this device's calendar than `now`: a sentence that names its
 *  time of day then has to say „morgen“ */
export function laterDay(at: number, now: number): boolean {
  const [then, today] = [new Date(at), new Date(now)];
  return then > today && then.toDateString() !== today.toDateString();
}

/** a number and its unit word, joined by U+00A0: „12 Min.“ */
export function unit(lang: Lang, n: number, word: string): string {
  return `${num(lang, n)}${NBSP}${word}`;
}

/** an ISO date as the language writes it: 10.10.2026 (de) / 2026-10-10 (en) */
export function date(lang: Lang, iso: string): string {
  const { locale, isoDate } = LANGUAGES[lang];
  if (isoDate) return iso.slice(0, 10);
  const [y = 0, m = 1, d = 1] = iso.slice(0, 10).split("-").map(Number);
  const options = { day: "2-digit", month: "2-digit", year: "numeric" } as const;
  return clean(new Intl.DateTimeFormat(locale, options).format(new Date(y, m - 1, d)));
}
