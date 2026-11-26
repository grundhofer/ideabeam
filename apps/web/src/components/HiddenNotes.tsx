// HiddenNotes.tsx: what a person learns about the others' notes while the wall is in its hidden writing: how many
// there are, and nothing else (PLAN.md 3.4). sebaro's hidden card is a glyph and the word „verdeckt“ in the note's
// place; here a note the browser may not read has no place either, so the notes of the others are one calm element
// with their number, the same on the surface and in the list, never one placeholder per note. It is no live region:
// the state sentence at the wall's top says the wall's count, paced; this would say every note of everybody.
import { useTranslation } from "react-i18next";
import { Icon } from "../sebaro/react/Icon";

export function HiddenNotes({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <p className="app-hidden">
      <Icon name="eye-off" size={20} />
      <span>{count === 0 ? t("wall.hiddenOthersNone") : t("wall.hiddenOthers", { count })}</span>
    </p>
  );
}
