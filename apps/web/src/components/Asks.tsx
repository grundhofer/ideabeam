// Asks.tsx: what a wall asks before it changes something for everyone, the same on the surface and in the list:
// whether a note goes, whether a group goes (and what becomes of its notes), and where notes are to be moved to.
// „Verschieben nach …“ is the way to move without dragging and without the arrow keys (WCAG 2.5.7): a dialog with
// the wall's groups as radio rows, after sebaro's part „Drag and drop“.
import { useEffect, type KeyboardEvent } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { Group, Note, NoteMove } from "@ideabeam/shared";
import { Dialog } from "../sebaro/react/Dialog";

// How much of a note's text a question or a menu's name quotes.
const QUOTE = 60;

/** The start of a text on one line, for a sentence that names a note. */
export function quoted(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > QUOTE ? `${line.slice(0, QUOTE).trimEnd()}…` : line;
}

/** A group's title as the wall shows it: its own, or „Ohne Titel“ while it has none. */
export function titleOf(t: TFunction, group: Pick<Group, "title">): string {
  return group.title === "" ? t("group.untitled") : group.title;
}

/** What a move did to the groups of the notes, as one sentence for a screen reader: „3 Zettel nach „Werkzeuge“
 *  verschoben.“, „3 Zettel liegen jetzt ohne Gruppe.“ One sentence for the whole move, never one per note
 *  (PLAN.md 3.7). null: no note changed its group, or the notes went to different groups. */
export function toldOfMove(
  t: TFunction,
  notes: ReadonlyMap<string, Note>,
  moves: readonly NoteMove[],
  groups: readonly Group[],
): string | null {
  const [first] = moves;
  if (first === undefined) return null;
  const changed = moves.some((move) => notes.get(move.noteId)?.groupId !== move.groupId);
  if (!changed || moves.some((move) => move.groupId !== first.groupId)) return null;
  if (first.groupId === null) return t("move.out", { count: moves.length });
  const group = groups.find((one) => one.id === first.groupId);
  return group === undefined ? null : t("move.into", { count: moves.length, group: titleOf(t, group) });
}

type NoteProps = {
  /** the start of the note's text, or null: nothing is asked */
  text: string | null;
  onClose(confirmed: boolean): void;
};

/** „Zettel löschen?“: says what is lost. */
export function DeleteNoteAsk({ text, onClose }: NoteProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      id="app-dlg-note"
      open={text !== null}
      title={t("note.deleteTitle")}
      text={t("note.deleteText", { text: text ?? "" })}
      onClose={(value) => onClose(value === "confirm")}
    >
      <button className="sb-secondary-action" value="cancel" data-sb-dialog-cancel>
        {t("common.cancel")}
      </button>
      <button className="sb-danger-action sb-danger-action--outlined" value="confirm">
        {t("note.delete")}
      </button>
    </Dialog>
  );
}

type GroupProps = {
  /** the group's title as the wall shows it and how many notes lie in it, or null: nothing is asked */
  group: { title: string; notes: number } | null;
  onClose(confirmed: boolean): void;
};

/** „Gruppe löschen?“: the frame goes, and the question says that its notes stay. */
export function DeleteGroupAsk({ group, onClose }: GroupProps) {
  const { t } = useTranslation();
  const title = group?.title ?? "";
  return (
    <Dialog
      id="app-dlg-group"
      open={group !== null}
      title={t("group.deleteTitle")}
      text={
        group !== null && group.notes > 0
          ? t("group.deleteText", { title, count: group.notes })
          : t("group.deleteTextEmpty", { title })
      }
      onClose={(value) => onClose(value === "confirm")}
    >
      <button className="sb-secondary-action" value="cancel" data-sb-dialog-cancel>
        {t("common.cancel")}
      </button>
      <button className="sb-danger-action sb-danger-action--outlined" value="confirm">
        {t("wall.deleteConfirm")}
      </button>
    </Dialog>
  );
}

const MOVE = "app-dlg-move";
const TARGET = "app-move-target";
// the value of „Keine Gruppe“: no group's id is empty
const NONE = "";

type MoveProps = {
  /** how many notes are to be moved and the group they all lie in now (null: in none; undefined: not all in the
   *  same), or null: nothing is asked */
  asking: { notes: number; from: string | null | undefined } | null;
  groups: readonly Group[];
  /** the group chosen, null for „Keine Gruppe“; undefined: the question was put away */
  onClose(target: string | null | undefined): void;
};

/** „Verschieben nach …“: the wall's groups and „Keine Gruppe“ as radio rows, then „Abbrechen“ and „Verschieben“.
 *  It opens on the group the notes lie in. */
export function MoveAsk({ asking, groups, onClose }: MoveProps) {
  const { t } = useTranslation();
  const open = asking !== null;
  // The dialog of the copy opens on its first action. Here the choice comes first: the focus goes to the chosen
  // row, where the arrow keys change it (this effect runs after the dialog's own).
  useEffect(() => {
    if (open) document.querySelector<HTMLInputElement>(`#${MOVE} input:checked`)?.focus();
  }, [open]);

  // Enter in a form presses its first button, which is „Abbrechen“: on the choice it means „Verschieben“.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    document.querySelector<HTMLButtonElement>(`#${MOVE} button[value="move"]`)?.click();
  };

  const start = asking?.from === undefined ? (groups[0]?.id ?? NONE) : (asking.from ?? NONE);
  return (
    <Dialog
      id={MOVE}
      open={open}
      title={t("note.move")}
      text={t("move.text", { count: asking?.notes ?? 1 })}
      // the rows are there while the question is: each time it opens on where the notes lie now
      body={
        open && (
          <fieldset className="app-choice" onKeyDown={onKeyDown}>
            <legend className="sb-visually-hidden">{t("move.target")}</legend>
            {groups.map((group) => (
              <label className="sb-radio" key={group.id}>
                <input type="radio" name={TARGET} value={group.id} defaultChecked={group.id === start} />
                <span>{group.title === "" ? t("group.untitled") : group.title}</span>
              </label>
            ))}
            <label className="sb-radio">
              <input type="radio" name={TARGET} value={NONE} defaultChecked={start === NONE} />
              <span>{t("move.none")}</span>
            </label>
          </fieldset>
        )
      }
      onClose={(value) => {
        const chosen = document.querySelector<HTMLInputElement>(`#${MOVE} input[name="${TARGET}"]:checked`);
        onClose(value !== "move" || chosen === null ? undefined : chosen.value === NONE ? null : chosen.value);
      }}
    >
      <button className="sb-secondary-action" value="cancel" data-sb-dialog-cancel>
        {t("common.cancel")}
      </button>
      <button className="sb-secondary-action" value="move">
        {t("move.confirm")}
      </button>
    </Dialog>
  );
}
