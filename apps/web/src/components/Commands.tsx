import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { platform } from "../sebaro/react/chords";
import { Palette, type PaletteGroup } from "../sebaro/react/Palette";
import { useAppearance } from "../store/appearance";
import { useChoices } from "./choices";

type Props = {
  /** the top-level places of the app, as Shell names them */
  places: ReadonlyArray<{ to: string; label: string }>;
};

/** The command palette every sebaro app opens with ⌘K (Strg+K elsewhere): the places, the app's commands and its
 *  settings, found by typing. A setting keeps its word and shows its state by the check alone. A command of the
 *  product is one more option here. */
export function Commands({ places }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, tone, language } = useChoices();
  const { reduceMotion, setReduceMotion } = useAppearance();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mac = platform() === "mac";
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || event.altKey || event.shiftKey) return;
      if (mac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      setOpen((now) => !now);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => () => void navigate(to);
  const [, warm] = tone;
  const groups: PaletteGroup[] = [
    {
      label: t("commands.places"),
      options: places.map(({ to, label }) => ({ id: `app-cmd-go-${to.slice(1) || "start"}`, label, run: go(to) })),
    },
    {
      label: t("walls.title"),
      options: [{ id: "app-cmd-new", label: t("new.title"), run: go("/neu") }],
    },
    {
      label: t("commands.look"),
      options: [
        ...theme.map(({ value, label, checked, choose }) => ({
          id: `app-cmd-${value}`,
          label,
          keywords: t("more.theme"),
          checked,
          run: choose,
        })),
        {
          id: "app-cmd-warm",
          label: t("commands.warm"),
          checked: warm.checked,
          run: () => (warm.checked ? tone[0] : warm).choose(),
        },
        {
          id: "app-cmd-motion",
          label: t("settings.motion"),
          checked: reduceMotion,
          run: () => setReduceMotion(!reduceMotion),
        },
      ],
    },
    {
      label: t("more.language"),
      options: language.map(({ value, label, checked, choose }) => ({
        id: `app-cmd-${value}`,
        label,
        checked,
        run: choose,
      })),
    },
  ];

  return (
    <Palette
      id="app-commands"
      open={open}
      label={t("commands.label")}
      searchLabel={t("commands.search")}
      groups={groups}
      hints={{ move: t("commands.move"), run: t("commands.run"), close: t("commands.close") }}
      keyWords={t("commands.keys", { returnObjects: true })}
      noneWord={(query) => t("commands.none", { query })}
      onClose={() => setOpen(false)}
    />
  );
}
