// input.ts: what a text typed into a form may be: a wall's question, a display name. The same bounds as the protocol
// (packages/shared), checked here so the form can say at the field what is wrong before anything is sent.
export const QUESTION_MAX = 140;
export const DISPLAY_NAME_MAX = 40;

export type TextFault = "missing" | "tooLong";

/** A text as it will be sent: without the spaces around it. */
export const tidy = (value: string) => value.trim();

/** What is wrong with a text of at most `max` characters, or undefined. */
export function checkText(value: string, max: number): TextFault | undefined {
  const text = tidy(value);
  if (!text) return "missing";
  if (text.length > max) return "tooLong";
  return undefined;
}
