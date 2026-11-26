import { useTranslation } from "react-i18next";
import { LANGUAGES, useLang, type Lang } from "../i18n";
import { useAppearance } from "../store/appearance";

/** The choices the „Mehr“ menu and the command palette both offer: „Hell oder Dunkel“, „Farbton“ and the
 *  language. One of each group is the chosen one. */
export function useChoices() {
  const { t, i18n } = useTranslation();
  const lang = useLang();
  const { theme, tone, setTheme, setTone } = useAppearance();
  return {
    theme: (["system", "light", "dark"] as const).map((value) => ({
      value,
      label: t(`more.${value}`),
      checked: value === theme,
      choose: () => setTheme(value),
    })),
    tone: (["cool", "warm"] as const).map((value) => ({
      value,
      label: t(`more.${value}`),
      checked: value === tone,
      choose: () => setTone(value),
    })),
    // a language is named in itself, whatever the page's language
    language: (Object.keys(LANGUAGES) as Lang[]).map((value) => ({
      value,
      label: LANGUAGES[value].name,
      checked: value === lang,
      choose: () => void i18n.changeLanguage(value),
    })),
  };
}
