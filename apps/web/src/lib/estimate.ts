// estimate.ts: the number a person types into the estimate (stage M3, components/Estimate.tsx), read as each
// language writes numbers. One separator is the decimal one, in either spelling: „2,5“ and „2.5“ are both two and a
// half, since a phone's keyboard may offer only one of them. Grouped thousands are read where they are unmistakable
// for the language: „1.200“ or „1.200,5“ in German, „1,200“ or „1,200.5“ in English. Spaces between digits are left
// out. Anything else is no number: the panel says so and sends nothing. The stored estimate is shown back as the
// language writes it („Gespeichert: 1.200 Tage“), so a misread number is seen at once.
import { ESTIMATE_LIMIT } from "@ideabeam/shared";

export type EstimateFault = "empty" | "notANumber" | "tooLarge";

/** The number in `text`, or why there is none. */
export function parseEstimate(
  text: string,
  lang: "de" | "en",
): { ok: true; value: number } | { ok: false; why: EstimateFault } {
  const bare = text.replace(/[\s\u00a0\u202f]/g, "").replace(/^\u2212/, "-");
  if (bare === "") return { ok: false, why: "empty" };
  const [group, decimal] = lang === "de" ? [".", ","] : [",", "."];
  const grouped = new RegExp(`^-?\\d{1,3}(\\${group}\\d{3})+(\\${decimal}\\d+)?$`);
  let plain: string;
  if (grouped.test(bare)) plain = bare.split(group).join("").replace(decimal, ".");
  else if (/^-?\d+([.,]\d+)?$/.test(bare)) plain = bare.replace(",", ".");
  else if (/^-?[.,]\d+$/.test(bare)) plain = bare.replace(/[.,]/, "0.");
  else return { ok: false, why: "notANumber" };
  const value = Number(plain);
  if (!Number.isFinite(value)) return { ok: false, why: "notANumber" };
  if (Math.abs(value) > ESTIMATE_LIMIT) return { ok: false, why: "tooLarge" };
  return { ok: true, value: value === 0 ? 0 : value };
}
