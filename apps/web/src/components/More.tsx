import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../sebaro/react/Icon";
import { MenuButton, type MenuEntry } from "../sebaro/react/Menu";
import { useChoices } from "./choices";

type Props = {
  /** the view's own entries, before the choices of appearance */
  first?: MenuEntry[];
  /** what deletes: last, after a line */
  last?: MenuEntry[];
};

/** The „Mehr“ menu in a room's head: the room's own entries, then „Hell oder Dunkel“, „Farbton“ and the language,
 *  then what deletes. A status line says the result of a choice of appearance. */
export function More({ first = [], last = [] }: Props) {
  const { t } = useTranslation();
  const { theme, tone, language } = useChoices();
  const [said, setSaid] = useState<"system" | "light" | "dark" | "cool" | "warm" | null>(null);

  // groups of choices, a line between them: one row of each group carries the check
  const entries: MenuEntry[] = [
    ...first,
    ...(first.length > 0 ? (["separator"] as const) : []),
    {
      heading: t("more.theme"),
      items: theme.map(({ value, label, checked, choose }) => ({
        label,
        radio: true,
        checked,
        onPress: () => {
          choose();
          setSaid(value);
        },
      })),
    },
    "separator",
    {
      heading: t("more.tone"),
      items: tone.map(({ value, label, checked, choose }) => ({
        label,
        radio: true,
        checked,
        onPress: () => {
          choose();
          setSaid(value);
        },
      })),
    },
    "separator",
    {
      heading: t("more.language"),
      items: language.map(({ value, label, checked, choose }) => ({
        label,
        lang: value,
        radio: true,
        checked,
        onPress: () => {
          // every word changes: nothing more to say
          setSaid(null);
          choose();
        },
      })),
    },
    ...(last.length > 0 ? (["separator"] as const) : []),
    ...last,
  ];

  return (
    <>
      <MenuButton
        id="app-more"
        label={t("more.label")}
        buttonLabel={t("more.label")}
        className="sb-icon-button"
        entries={entries}
        checks
      >
        <Icon name="more-horizontal" />
      </MenuButton>
      <p className="sb-visually-hidden" role="status">
        {said && t(`more.${said}IsOn`)}
      </p>
    </>
  );
}
