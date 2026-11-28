// AgendaDialog.tsx: „Ablauf“ under „Mehr“, the moderation's agenda on the wall (stage M7, PLAN-METHODEN.md 5). The
// methods the wall has begun stand first, as they are: a step that was reached never changes. The methods after them
// may be added, removed, moved and chosen anew, each with its prompt (components/AgendaBuilder.tsx). „Übernehmen“
// sends the whole agenda (`admin.agenda.set`, store/wall.ts); it shows once the wall has said so, to everybody at
// once. A draft lives in this dialog only: closing it without „Übernehmen“ changes nothing.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CATALOGUE,
  reachedItems,
  requestOf,
  type AgendaItemRequest,
  type MethodLanguage,
  type ResolvedAgenda,
} from "@ideabeam/shared";
import { tidy } from "../lib/input";
import { Dialog } from "../sebaro/react/Dialog";
import { AgendaBuilder, agendaFaults, estimates, newItem, type AgendaItem } from "./AgendaBuilder";

type Props = {
  open: boolean;
  lang: MethodLanguage;
  agenda: ResolvedAgenda;
  /** the furthest step the wall has reached: the methods begun up to it stay as they are */
  reach: number;
  /** the whole agenda as the moderation wants it */
  onSave(items: AgendaItemRequest[]): void;
  onClose(): void;
};

/** The items of the agenda as the builder edits them. */
function draftOf(agenda: ResolvedAgenda): AgendaItem[] {
  return requestOf(agenda).map((item) => newItem(item.methodId, item.prompt ?? "", item.unit ?? ""));
}

export function AgendaDialog({ open, lang, agenda, reach, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const fixed = reachedItems(agenda, reach);
  const [draft, setDraft] = useState<{ items: AgendaItem[]; active: number } | null>(null);
  const [faults, setFaults] = useState<Record<string, { prompt?: string; unit?: string }>>({});
  // a draft is made when the dialog opens, from the agenda as it stands then
  const [wasOpen, setWasOpen] = useState(false);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      const items = draftOf(agenda);
      setDraft({ items, active: Math.min(fixed, items.length) });
      setFaults({});
    }
  }
  const items = draft?.items ?? draftOf(agenda);
  const stored = requestOf(agenda);

  const save = () => {
    const found = agendaFaults(items.slice(fixed), {
      prompt: (max) => t("common.tooLong", { label: t("agenda.promptLabel"), max }),
      unit: (max) => t("common.tooLong", { label: t("new.unit"), max }),
    });
    if (found !== null) {
      setFaults(found);
      return false;
    }
    onSave([
      // the methods begun, exactly as the wall has them
      ...stored.slice(0, fixed),
      ...items.slice(fixed).map((item) => ({
        methodId: item.methodId,
        ...(estimates(item.methodId) && tidy(item.unit) !== "" ? { unit: tidy(item.unit) } : {}),
        ...(CATALOGUE[item.methodId].fields === undefined ? {} : { language: lang }),
        ...(tidy(item.prompt) !== "" ? { prompt: tidy(item.prompt) } : {}),
      })),
    ]);
    return true;
  };

  return (
    <Dialog
      id="app-dlg-agenda"
      open={open}
      title={t("wall.agenda.title")}
      text={t("wall.agenda.text")}
      body={
        // the builder only while the dialog is open: its live region would stand beside the wall's own
        open && (
          <AgendaBuilder
            lang={lang}
            id="app-agenda-wall"
            items={items}
            fixed={fixed}
            active={draft?.active ?? fixed}
            faults={faults}
            listed
            holdEnter
            onChange={(next, active) => setDraft({ items: next, active })}
          />
        )
      }
      onClose={(value) => {
        if (value === "save" && !save()) return;
        onClose();
      }}
    >
      <button className="sb-secondary-action" value="cancel" data-sb-dialog-cancel>
        {t("common.cancel")}
      </button>
      <button className="sb-secondary-action" value="save">
        {t("wall.agenda.save")}
      </button>
    </Dialog>
  );
}
