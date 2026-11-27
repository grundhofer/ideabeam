// WallList.tsx: the wall as a list, the full second way to it (PLAN.md 3.7): the groups as headings, the notes as
// rows under them, the notes without a group under a heading of their own. It shows the same wall as the surface
// and changes it by the same commands: a new note, a note's text, its end, its group („Verschieben nach …“), a new
// group, a group's title and its end. It carries screen readers and narrow screens: on a phone it is how a wall
// opens (lib/wall-view.ts). As on the surface, nobody sees or hears who wrote a note; one's own note says „Deiner“.
// While the notes are hidden the list holds a person's own notes, under „Deine Zettel“, and says in one line how many
// the others have written (HiddenNotes.tsx).
//
// Once the wall has teams (stage M4), the notes without a group that lie in a team's area stand under that team's
// heading („Team 3“, the person's own „Team 3 · dein Team“), before the others; in a step of teams a note written here
// goes into the person's own team's area. No heading names who is in a team: the step's head says that to the team.
//
// While the moderation waits for a proposal of the AI or looks at one (`paused`), the list shows and changes nothing:
// its rows and headings have no menus. A proposal's groups stand in it as its headings, like any group.
//
// What the list cannot show is where things lie. A note written here gets a free place outside every frame, a
// group made here a frame beside everything, a note moved into a group a free place in its frame: the same
// arithmetic the surface uses, without a view (lib/surface/groups.ts).
import { memo, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  generateHexId,
  GROUP_TITLE_MAX,
  MAX_GROUPS,
  MAX_NOTES,
  mayDeleteNote,
  mayEditNote,
  NOTE_TEXT_MAX,
  type Note,
} from "@ideabeam/shared";
import { changing, looseFrame, looseSpot, movedToAnywhere } from "../lib/surface/groups";
import { boxOf, freeSpot, sizeOf } from "../lib/surface/notes";
import { Field } from "../sebaro/react/Field";
import { Icon } from "../sebaro/react/Icon";
import { MenuButton, type MenuEntry } from "../sebaro/react/Menu";
import { DeleteGroupAsk, DeleteNoteAsk, MoveAsk, quoted, titleOf, toldOfMove } from "./Asks";
import { HiddenNotes } from "./HiddenNotes";
import type { WallProps } from "./Surface";

// The count of characters shows once the text comes near the limit, as on the surface.
const LENGTH_FROM = NOTE_TEXT_MAX - 50;

/** What is being written in the list: a note's text or a group's title, of a new one (`id` null) or of one that
 *  exists. One at a time. */
type Editing = { kind: "note"; id: string | null; text: string } | { kind: "group"; id: string | null; title: string };
/** What the list asks before it changes the wall. */
type Asking =
  { about: "note"; id: string; text: string } | { about: "group"; id: string } | { about: "move"; id: string };

type NoteEditorProps = {
  /** the text as it stands: empty for a new note */
  before: string;
  /** the writing ends: the text to save, or null: it is left as it was */
  onDone(text: string | null): void;
};

/** Brings a field of the list into the window whole, with its label and its two actions: above the action zone,
 *  which stays at the window's bottom edge (the page keeps that room free at its end). The focus alone leaves a
 *  field where it stands as long as a part of it is in the window, also a part under the zone. */
function shown(form: HTMLFormElement | null) {
  // (jsdom knows no scrolling)
  if (typeof form?.scrollIntoView === "function") form.scrollIntoView({ block: "nearest", behavior: "instant" });
}

/** A note's text as a field in the note's row: its label above it, „Abbrechen“ and „Sichern“ under it. Enter saves,
 *  Shift and Enter is a new line, Escape leaves, as on the surface. */
function NoteEditor({ before, onDone }: NoteEditorProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(before);
  const field = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    shown(el.form);
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onDone(text);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onDone(null);
    }
  };

  return (
    <form
      className="app-list__editor"
      onSubmit={(event) => {
        event.preventDefault();
        onDone(text);
      }}
    >
      <Field
        id="app-list-text"
        label={t("note.text")}
        help={text.length >= LENGTH_FROM ? t("note.length", { used: text.length, max: NOTE_TEXT_MAX }) : undefined}
      >
        {(control) => (
          <textarea
            {...control}
            ref={field}
            rows={3}
            maxLength={NOTE_TEXT_MAX}
            placeholder={t("note.placeholder")}
            enterKeyHint="done"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
          />
        )}
      </Field>
      <div className="app-list__actions">
        <button className="sb-text-action" type="button" onClick={() => onDone(null)}>
          {t("common.cancel")}
        </button>
        <button className="sb-secondary-action" type="submit">
          {t("note.save")}
        </button>
      </div>
    </form>
  );
}

type TitleEditorProps = {
  /** the title as it stands: empty for a new group */
  before: string;
  /** the writing ends: the title to save (it may be empty), or null: it is left as it was */
  onDone(title: string | null): void;
};

/** A group's title as a field in the place of its heading. Enter saves, Escape leaves. A title may stay empty. */
function TitleEditor({ before, onDone }: TitleEditorProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(before);
  const field = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    shown(el.form);
  }, []);

  return (
    <form
      className="app-list__editor"
      onSubmit={(event) => {
        event.preventDefault();
        onDone(title);
      }}
    >
      <Field
        id="app-list-title"
        label={t("group.title")}
        optional={t("common.optional")}
        help={t("group.titleHelp", { max: GROUP_TITLE_MAX })}
      >
        {(control) => (
          <input
            {...control}
            ref={field}
            type="text"
            maxLength={GROUP_TITLE_MAX}
            autoComplete="off"
            enterKeyHint="done"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              event.stopPropagation();
              onDone(null);
            }}
          />
        )}
      </Field>
      <div className="app-list__actions">
        <button className="sb-text-action" type="button" onClick={() => onDone(null)}>
          {t("common.cancel")}
        </button>
        <button className="sb-secondary-action" type="submit">
          {t("note.save")}
        </button>
      </div>
    </form>
  );
}

// where the focus goes once the list is drawn again: a row's or a heading's menu, or a heading itself
const rowMenu = (noteId: string) => `[data-note="${noteId}"] button[aria-haspopup]`;
const groupMenu = (groupId: string) => `[data-group="${groupId}"] button[aria-haspopup]`;
const headingId = (groupId: string | null) => `app-list-h-${groupId ?? "none"}`;

export const WallList = memo(function WallList({
  ref,
  notes,
  groups,
  hidden,
  you,
  send,
  problem,
  onRefuse,
  onDismiss,
  say,
  paused = false,
  areas = null,
  ownArea = null,
}: WallProps) {
  const { t } = useTranslation();
  const root = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  // What takes the focus once the list has been drawn again, as a selector: a row that moved to another heading
  // is another element, and a row that is gone leaves the focus nowhere. Where the selector finds nothing (the
  // last note under a heading went, and the heading with it), the list itself takes the focus.
  const focusNext = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (focusNext.current === null) return;
    const el = root.current?.querySelector<HTMLElement>(focusNext.current);
    focusNext.current = null;
    (el ?? root.current)?.focus();
  });
  // Where the page stood when a field opened. The page moves to show the field above the action zone; a short list
  // that fits the window would stay shifted afterwards, with the wall's head partly out of view (the wall's footer
  // lies under the window, so the page can always move a little). When the writing ends the page goes back to
  // where it stood, or as near to it as leaves what has the focus then in view: in a long list the new row at its
  // end stays in the window, above the zone.
  const pageAt = useRef<number | null>(null);
  const begin = (next: Editing) => {
    pageAt.current ??= window.scrollY;
    setEditing(next);
  };
  useLayoutEffect(() => {
    const before = pageAt.current;
    if (editing !== null || before === null) return;
    pageAt.current = null;
    const by = window.scrollY - before;
    if (by === 0) return;
    let to = before;
    // what has the focus now (the new row's menu), where it would stand with the page back. What stands in the
    // zone is in view anywhere, and something taller than the window (the list itself) asks for no place
    const focused = document.activeElement;
    if (focused !== null && focused !== document.body && focused.closest(".sb-bottom-block") === null) {
      const zone = getComputedStyle(document.documentElement).getPropertyValue("--sb-bottom-block-size");
      const limit = window.innerHeight - (parseFloat(zone) || 0);
      const box = focused.getBoundingClientRect();
      const [top, bottom] = [box.top + by, box.bottom + by];
      if (bottom - top <= limit) to = bottom > limit ? before + bottom - limit : top < 0 ? before + top : before;
    }
    if (to !== window.scrollY) window.scrollTo({ top: to, behavior: "instant" });
  }, [editing]);
  // what had the focus when a new note or a new group was begun: it gets it back when nothing is made
  const opener = useRef<Element | null>(null);
  const backToOpener = () => {
    if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus();
  };

  const byId = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);

  // the notes under their headings: by group, and those without one (a group that is gone counts as none)
  const { inGroup, loose } = useMemo(() => {
    const known = new Set(groups.map((group) => group.id));
    const sorted = new Map<string, Note[]>();
    const rest: Note[] = [];
    for (const note of notes) {
      if (note.groupId === null || !known.has(note.groupId)) rest.push(note);
      else sorted.set(note.groupId, [...(sorted.get(note.groupId) ?? []), note]);
    }
    return { inGroup: sorted, loose: rest };
  }, [notes, groups]);
  // the notes without a group that lie in a team's area, by team; the rest stay under the heading of their own
  const { inArea, outside } = useMemo(() => {
    const byArea = new Map<number, Note[]>();
    const rest: Note[] = [];
    for (const note of loose) {
      const area = areas?.find(
        ({ box }) => note.x >= box.x && note.x < box.x + box.w && note.y >= box.y && note.y < box.y + box.h,
      );
      if (area === undefined) rest.push(note);
      else byArea.set(area.n, [...(byArea.get(area.n) ?? []), note]);
    }
    return { inArea: byArea, outside: rest };
  }, [loose, areas]);

  // every row's menu has a number of its own, in the order the rows stand in
  const order = useMemo(
    () =>
      new Map(
        [
          ...groups.flatMap((group) => inGroup.get(group.id) ?? []),
          ...(areas ?? []).flatMap((area) => inArea.get(area.n) ?? []),
          ...outside,
        ].map((note, n) => [note.id, n + 1]),
      ),
    [groups, inGroup, areas, inArea, outside],
  );

  useImperativeHandle(ref, () => ({
    compose() {
      if (paused) return;
      if (notes.length >= MAX_NOTES) return onRefuse({ code: "LIMIT", command: "note.create" });
      opener.current = document.activeElement;
      begin({ kind: "note", id: null, text: "" });
    },
    group() {
      if (paused) return;
      if (groups.length >= MAX_GROUPS) return onRefuse({ code: "LIMIT", command: "group.create" });
      opener.current = document.activeElement;
      begin({ kind: "group", id: null, title: "" });
    },
    // the list has no view: every row is there to scroll to
    lookAt() {},
    lookBack() {},
    focus: () => root.current?.focus(),
  }));

  /** A note's text was written: a new note gets a free place outside every frame; one that exists gets its text. */
  const saveNote = (id: string | null, written: string | null) => {
    setEditing(null);
    const text = written?.trim() ?? "";
    if (id !== null) {
      // back on the row the writing began in
      focusNext.current = rowMenu(id);
      if (text !== "" && text !== byId.get(id)?.text)
        send({ type: "note.update", opId: generateHexId(), noteId: id, text });
      return;
    }
    if (text === "") return backToOpener();
    const noteId = generateHexId();
    // in a step of teams: in the person's own team's area
    const spot =
      ownArea === null
        ? looseSpot(sizeOf(text), notes, groups)
        : freeSpot(sizeOf(text), notes.map(boxOf), ownArea, {
            x: ownArea.x + 16 + sizeOf(text).w / 2,
            y: ownArea.y + 48 + sizeOf(text).h / 2,
          });
    send({ type: "note.create", opId: generateHexId(), noteId, text, x: spot.x, y: spot.y });
    focusNext.current = rowMenu(noteId);
  };

  /** A group's title was written: a new group gets a frame beside everything; one that exists gets its title. */
  const saveGroup = (id: string | null, written: string | null) => {
    setEditing(null);
    if (id !== null) {
      focusNext.current = groupMenu(id);
      const title = written?.trim();
      if (title !== undefined && title !== groups.find((group) => group.id === id)?.title) {
        send({ type: "group.update", opId: generateHexId(), groupId: id, title });
      }
      return;
    }
    if (written === null) return backToOpener();
    const groupId = generateHexId();
    send({
      type: "group.create",
      opId: generateHexId(),
      groupId,
      title: written.trim(),
      ...looseFrame(notes, groups),
    });
    say(t("group.made"));
    focusNext.current = groupMenu(groupId);
  };

  /** „Verschieben nach …“ was answered: the note gets a free place in the group's frame, which grows where it has
   *  to, or a free place outside every frame. */
  const moveInto = (id: string, to: string | null) => {
    const note = byId.get(id);
    const target = to === null ? null : groups.find((group) => group.id === to);
    if (note === undefined || target === undefined) return;
    const { moves, frame } = movedToAnywhere([note], target, notes, groups);
    const real = changing(moves, byId);
    if (real.length === 0) return;
    if (target !== null && frame !== null) {
      send({ type: "group.update", opId: generateHexId(), groupId: target.id, w: frame.w, h: frame.h });
    }
    send({ type: "notes.move", opId: generateHexId(), moves: real });
    const told = toldOfMove(t, byId, real, groups);
    if (told !== null) say(told);
    // the row stands under another heading now
    focusNext.current = rowMenu(id);
  };

  const noteRow = (note: Note) => {
    if (editing?.kind === "note" && editing.id === note.id) {
      return (
        <li className="sb-list-row app-list__row" key={note.id} data-note={note.id}>
          <NoteEditor before={editing.text} onDone={(text) => saveNote(note.id, text)} />
        </li>
      );
    }

    const entries: MenuEntry[] = [
      ...(mayEditNote(note)
        ? [{ label: t("note.edit"), onPress: () => begin({ kind: "note", id: note.id, text: note.text }) }]
        : []),
      ...(groups.length > 0
        ? [{ label: t("note.move"), onPress: () => setAsking({ about: "move", id: note.id }) }]
        : []),
      ...(mayDeleteNote(note, you)
        ? [
            {
              label: t("note.delete"),
              danger: true,
              onPress: () => setAsking({ about: "note", id: note.id, text: quoted(note.text) }),
            },
          ]
        : []),
    ];
    const more = t("note.more", { text: quoted(note.text) });
    return (
      <li className="sb-list-row app-list__row" key={note.id} data-note={note.id}>
        <div className="sb-list-row__main">
          {/* the text with the breaks its writer made. Nobody sees who wrote it; one's own note says that it is */}
          <p className="sb-list-row__title app-list__text">{note.text}</p>
          {note.mine && <p className="sb-list-row__meta app-list__own">{t("note.own")}</p>}
        </div>
        {/* while the wall is paused (the moderation waits for a proposal or looks at one) a row has no menu: the
            list shows, and changes nothing */}
        {entries.length > 0 && !paused && (
          <span className="sb-list-row__trail">
            <MenuButton
              id={`app-row-${order.get(note.id) ?? 0}`}
              label={more}
              buttonLabel={more}
              className="sb-icon-button"
              entries={entries}
            >
              <Icon name="more-vertical" />
            </MenuButton>
          </span>
        )}
      </li>
    );
  };

  const writingNew = editing?.kind === "note" && editing.id === null;
  const namingNew = editing?.kind === "group" && editing.id === null;
  const askedNote = asking?.about === "move" ? byId.get(asking.id) : undefined;
  const askedGroup = asking?.about === "group" ? groups.find((group) => group.id === asking.id) : undefined;
  const none = notes.length === 0 && groups.length === 0 && editing === null;

  return (
    <section ref={root} className="app-list" aria-label={t("list.label")} tabIndex={-1}>
      {/* a change that was not taken: why, as on the surface. The region is there before its sentence */}
      <div className="app-surface__problem" role="alert">
        {problem !== null && (
          <>
            <Icon name="error--filled-16" size={16} />
            <p>{problem}</p>
            <button className="sb-icon-button" type="button" aria-label={t("surface.dismiss")} onClick={onDismiss}>
              <Icon name="close" />
            </button>
          </>
        )}
      </div>
      {/* the others' notes while the wall is hidden: how many, and nothing else */}
      {hidden !== null && <HiddenNotes count={hidden} />}
      {none && <p className="sb-list-end app-list__none">{t(hidden === null ? "list.empty" : "list.emptyHidden")}</p>}
      {groups.map((group, index) => {
        const title = titleOf(t, group);
        const rows = inGroup.get(group.id) ?? [];
        const more = t("group.more", { title });
        const heading = headingId(group.id);
        return (
          <section key={group.id} aria-labelledby={heading}>
            {editing?.kind === "group" && editing.id === group.id ? (
              <>
                {/* the heading stays for a screen reader while its field stands in its place */}
                <h2 className="sb-visually-hidden" id={heading}>
                  {title}
                </h2>
                <TitleEditor before={editing.title} onDone={(written) => saveGroup(group.id, written)} />
              </>
            ) : (
              <div className="app-list__head" data-group={group.id}>
                <h2 className="sb-list-header" id={heading} tabIndex={-1}>
                  <span className={group.title === "" ? "app-muted" : undefined}>{title}</span>{" "}
                  <span className="sb-list-header__count">{rows.length}</span>
                </h2>
                {!paused && (
                  <MenuButton
                    id={`app-group-menu-${index + 1}`}
                    label={more}
                    buttonLabel={more}
                    className="sb-icon-button"
                    entries={[
                      {
                        label: t("group.rename"),
                        onPress: () => begin({ kind: "group", id: group.id, title: group.title }),
                      },
                      {
                        label: t("group.delete"),
                        danger: true,
                        onPress: () => setAsking({ about: "group", id: group.id }),
                      },
                    ]}
                  >
                    <Icon name="more-vertical" />
                  </MenuButton>
                )}
              </div>
            )}
            {rows.length > 0 ? (
              <ul className="sb-list" aria-labelledby={heading}>
                {rows.map(noteRow)}
              </ul>
            ) : (
              <p className="sb-list-end">{t("group.empty")}</p>
            )}
          </section>
        );
      })}
      {namingNew && (
        <section aria-label={t("group.new")}>
          <TitleEditor before="" onDone={(written) => saveGroup(null, written)} />
        </section>
      )}
      {areas?.map((area) => {
        const rows = inArea.get(area.n) ?? [];
        if (rows.length === 0) return null;
        const heading = `app-list-team-${area.n}`;
        return (
          <section key={area.n} aria-labelledby={heading}>
            <div className="app-list__head">
              <h2 className="sb-list-header" id={heading} tabIndex={-1}>
                {area.label} <span className="sb-list-header__count">{rows.length}</span>
              </h2>
            </div>
            <ul className="sb-list" aria-labelledby={heading}>
              {rows.map(noteRow)}
            </ul>
          </section>
        );
      })}
      {(outside.length > 0 || writingNew) && (
        <section aria-labelledby={headingId(null)}>
          <div className="app-list__head">
            {/* on a wall without groups these are simply its notes; while the notes are hidden, one's own */}
            <h2 className="sb-list-header" id={headingId(null)} tabIndex={-1}>
              {groups.length > 0
                ? t("list.ungrouped")
                : hidden === null
                  ? t("list.notes")
                  : areas !== null
                    ? t("list.ownTeam")
                    : t("list.own")}{" "}
              <span className="sb-list-header__count">{outside.length}</span>
            </h2>
          </div>
          <ul className="sb-list" aria-labelledby={headingId(null)}>
            {outside.map(noteRow)}
            {writingNew && (
              <li className="sb-list-row app-list__row">
                <NoteEditor before="" onDone={(text) => saveNote(null, text)} />
              </li>
            )}
          </ul>
        </section>
      )}
      <DeleteNoteAsk
        text={asking?.about === "note" ? asking.text : null}
        onClose={(confirmed) => {
          const asked = asking;
          setAsking(null);
          if (!confirmed || asked?.about !== "note") return;
          // the row is gone: its heading takes the focus
          const groupId = byId.get(asked.id)?.groupId ?? null;
          focusNext.current = `#${headingId(groupId !== null && inGroup.has(groupId) ? groupId : null)}`;
          send({ type: "note.delete", opId: generateHexId(), noteId: asked.id });
        }}
      />
      <DeleteGroupAsk
        group={askedGroup ? { title: titleOf(t, askedGroup), notes: inGroup.get(askedGroup.id)?.length ?? 0 } : null}
        onClose={(confirmed) => {
          const asked = asking;
          setAsking(null);
          if (!confirmed || asked?.about !== "group") return;
          // its notes stand under the heading of the notes without a group now: that heading takes the focus
          focusNext.current = `#${headingId(null)}`;
          const left = inGroup.get(asked.id)?.length ?? 0;
          send({ type: "group.delete", opId: generateHexId(), groupId: asked.id });
          say(left > 0 ? t("group.deletedNotes", { count: left }) : t("group.deleted"));
        }}
      />
      <MoveAsk
        asking={askedNote ? { notes: 1, from: askedNote.groupId } : null}
        groups={groups}
        onClose={(to) => {
          const asked = asking;
          setAsking(null);
          if (to !== undefined && asked?.about === "move") moveInto(asked.id, to);
        }}
      />
    </section>
  );
});
