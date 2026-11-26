import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../sebaro/react/Icon";

type Props = {
  /** the key's word: „Link kopieren“ */
  word: string;
  /** what goes to the clipboard */
  text: string;
  /** in the wall's head: a quiet text action, on a phone its icon alone (the word stays for a screen reader) */
  quiet?: boolean;
  /** a text action that shows its word at every width: in a dialog, beside its one outlined action */
  inline?: boolean;
};

/** A key that copies a link. It shows its own result: „Kopiert“ in itself for two seconds, no toast; a screen
 *  reader hears the same word. */
export function CopyKey({ word, text, quiet, inline }: Props) {
  const { t } = useTranslation();
  const [result, setResult] = useState<"copied" | "copyFailed" | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setResult("copied");
    } catch {
      setResult("copyFailed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setResult(null), 2000);
  };

  return (
    <>
      <button
        className={quiet ? "sb-text-action app-copy-key" : inline ? "sb-text-action" : "sb-secondary-action"}
        type="button"
        onClick={() => void copy()}
      >
        <Icon name={result === "copied" ? "check" : "link"} />
        <span className="app-copy-key__word">{result ? t(`wall.${result}`) : word}</span>
      </button>
      <span className="sb-visually-hidden" role="status">
        {result ? t(`wall.${result}`) : ""}
      </span>
    </>
  );
}
