// Surface.tsx: the wall's surface: a ground without an edge that shows the notes and the groups, pans and zooms,
// and lets everyone write, change, move and delete notes, make, name, move, resize and delete groups, and select
// several notes to move them as one. The plan's own DOM surface (PLAN.md 3.1), written here after the pattern of
// RetroBeam's BoardCanvas.tsx (docs/HERKUNFT.md).
//
// How it is built:
// - The world is one element, moved and scaled by one CSS transform. The view (lib/surface/view.ts) is no React
//   state: panning and zooming write that transform and render nothing. A note renders when it changes itself.
// - A drag moves the elements by a transform of their own and tells the wall once, when it ends: one `notes.move`
//   for a note or a whole selection, one `group.update` and at most one `notes.move` for a frame, never one per
//   frame of the screen (PLAN.md 3.4).
// - A group is a frame without fill with its title (sebaro „Collaboration“), drawn before the notes, so a note
//   always lies above it. A note belongs to the frame its middle lies in (lib/surface/groups.ts): whoever moves a
//   note or a frame says the place and the group in the same command.
// - What must keep its size stands outside the zoomed world: the tools, the mark around the current note or group
//   with the handle that resizes a group, the keys. The field a note or a group's title is written in stands in a
//   second layer that follows the world, and the view goes to life size for it, so it is never smaller than a field.
// - The ground is one tab stop, a list box whose options are the groups and the notes (PLAN.md 3.7): the arrow keys
//   go from note to note, G from group to group, the focus stays on the ground, so a note somebody else deletes
//   takes no focus with it. Several notes can be selected: the picked ones, or else the current one, are what the
//   tools and the move mode act on.
// - Nobody sees who wrote a note, and a screen reader does not say it either (the owner's decision of 2026-11-22):
//   no name is read from a note's author anywhere here. One's own note carries a small word, „Deiner“, for its
//   writer alone, so a person knows which notes they may change.
// - While the notes are hidden (the wall's phase `writing`) the surface holds a person's own notes alone. Of the
//   others' it says how many there are, in one line above the ground (HiddenNotes.tsx): a note the browser may not
//   read has no text, no length and no place here.
// - Several notes are selected with Shift and a press or with the keys; „Auswählen“ in the tools is the way for a
//   finger, which has no Shift: while it is on, a press on a note takes it into the selection or out of it.
// - Every length is a unit of 1/16 rem (PLAN.md 3.1): pixels are turned into units where a pointer is read.
// - An arrangement moves (PLAN.md 4.3, step 8): when the AI's arrangement is applied or taken back, and when the
//   moderation's preview of a proposal opens or closes, the notes glide to their places one after the other, all
//   there within 600 ms (the owner's exception to sebaro's 200 ms, docs/sebaro-luecken.md A3); under reduced
//   motion they jump. Nothing else on the surface glides: a note somebody else drags arrives where it was put.
// - While the moderation waits for a proposal or looks at one (`paused`), its own changing of the wall rests: the
//   view still pans and zooms and the keys still go from note to note, but nothing is written, moved or deleted.
import {
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type Ref,
} from "react";
import { useTranslation } from "react-i18next";
import {
  estimateNoteHeight,
  generateHexId,
  GROUP_TITLE_MAX,
  MAX_GROUPS,
  MAX_NOTES,
  mayDeleteNote,
  mayEditNote,
  NOTE_LINE_HEIGHT,
  NOTE_MIN_LINES,
  NOTE_PADDING,
  NOTE_TEXT_MAX,
  type ContentCommand,
  type Group,
  type Note,
  type NoteMove,
  type Participant,
} from "@ideabeam/shared";
import {
  changing,
  everything,
  frameAround,
  framed,
  GROUP_HEAD,
  groupOf,
  middleOf,
  movedTo,
  NEW_GROUP,
  reframed,
  shifted,
} from "../lib/surface/groups";
import { boxOf, freeSpot, nearestInDirection, sizeOf, STEP, stepped, type Direction } from "../lib/surface/notes";
import {
  fit,
  MARGIN,
  panBy,
  pinch,
  reveal,
  toSurface,
  toWorld,
  visible,
  wheelZoom,
  zoomAt,
  ZOOM_STEP,
  type Box,
  type Point,
  type Size,
  type View,
} from "../lib/surface/view";
import type { Rejected } from "../store/wall";
import { Icon } from "../sebaro/react/Icon";
import { DeleteGroupAsk, DeleteNoteAsk, MoveAsk, quoted, titleOf, toldOfMove } from "./Asks";
import { HiddenNotes } from "./HiddenNotes";

/** What the wall asks of the view that shows it, the surface or the list. */
export type WallHandle = {
  /** „Neuer Zettel“: a field for a new note, open for writing. */
  compose(): void;
  /** „Neue Gruppe“: a field for the title of a new group. */
  group(): void;
  /** Shows a part of the wall whole („Alles zeigen“ of that box): the preview of a proposal, and the arrangement
   *  once it is applied. With `remember` the view it leaves is kept for `lookBack`; without, there is no way back
   *  any more. The list has no view: there it does nothing. */
  lookAt(box: Box, remember: boolean): void;
  /** Back to the view `lookAt` remembered, if there is one: the proposal was discarded. */
  lookBack(): void;
  /** The wall's content takes the focus: the surface's ground, or the list. Where the focus goes once what had it
   *  is gone and the wall itself is what an action changed. */
  focus(): void;
};

/** What a view of the wall gets: the surface and the list show the same wall and change it the same way. */
export type WallProps = {
  ref?: Ref<WallHandle>;
  /** the notes as this browser shows them: `shown(state).notes` */
  notes: Note[];
  /** the groups as this browser shows them, in the order they were made: `shown(state).groups` */
  groups: Group[];
  /** While the notes are hidden: how many notes of the others the wall holds, which this browser has not got. null:
   *  the wall is revealed, `notes` are everybody's. */
  hidden: number | null;
  /** the person this browser is: their own notes are marked as theirs, and theirs to change */
  you: Participant;
  /** a change, applied at once and sent to the wall (store/wall.ts) */
  send(command: ContentCommand): void;
  /** the sentence of the last change that was not taken, or null */
  problem: string | null;
  /** a change the rules refuse before it is sent: the same sentence as the wall's own reject */
  onRefuse(rejected: Rejected): void;
  onDismiss(): void;
  /** says a sentence to a screen reader: the result of what this person just did */
  say(sentence: string): void;
  /** The moderation waits for a proposal of the AI or looks at one: this person's own changing of the wall rests.
   *  Looking stays: the view, the keys that go from note to note, the choice between surface and list. */
  paused?: boolean;
  /** Names the arrangement the wall shows: whenever it reads otherwise (an arrangement was applied or taken back, a
   *  preview opened or closed), the notes glide to their places instead of jumping. The surface alone moves. */
  motion?: string;
};

// The count of characters shows once the text comes near the limit: before, it would only be noise.
const LENGTH_FROM = NOTE_TEXT_MAX - 50;
// The height that line takes under the field, with its gap, in units.
const LENGTH_LINE = 28;
// A pointer that moved less than this many pixels has pressed, not dragged.
const DRAG_FROM = 4;
// How long the world stays its own layer after the view last moved.
const REST_MS = 200;
// The widest part of a frame's head that is brought into view for its title's field, in units.
const TITLE_ROOM = 320;
// An arrangement's motion: how long a note glides, and how long after the first note the last one sets out. Together
// the 600 ms the owner allowed for it (docs/sebaro-luecken.md, A3).
const GLIDE_MS = 300;
const GLIDE_STAGGER_MS = 300;
// The keys that only look: they work while the wall is paused too.
const LOOKING = new Set(["g", "G", "+", "=", "-", "_", "0"]);

const ARROWS: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

const NOBODY: ReadonlySet<string> = new Set();
const NOWHERE: Point = { x: 0, y: 0 };

const rem = (units: number) => `${units / 16}rem`;
const noteId = (id: string) => `app-note-${id}`;
const frameId = (id: string) => `app-group-${id}`;
const NOTE_FIELD = "app-note-field";
const GROUP_FIELD = "app-group-field";

/** The note or the group the keys and the tools are on. */
type Current = { kind: "note" | "group"; id: string };

type Gesture =
  | { kind: "pan"; pointer: number; from: Point; view: View; moved: boolean }
  | {
      kind: "drag";
      pointer: number;
      from: Point;
      /** the note under the pointer, and every note that goes with it: the selection it belongs to */
      pressed: Note;
      notes: Note[];
      els: HTMLElement[];
      lift: Point;
      moved: boolean;
      /** a press without a drag leaves the pressed note the only one selected */
      reduce: boolean;
      /** a press without a drag takes the pressed note out of the selection again („Auswählen“ is on) */
      unpick: boolean;
    }
  | {
      kind: "frame";
      pointer: number;
      from: Point;
      group: Group;
      el: HTMLElement;
      /** the notes that go with the frame; none while its size changes */
      els: HTMLElement[];
      /** the handle changes the frame's size; its head moves it */
      size: boolean;
      lift: Point;
      moved: boolean;
    }
  | { kind: "pinch"; pointers: [number, number]; from: [Point, Point]; view: View };

/** A note being written: a new one (`id` null) at its place, or one that exists. */
type Writing = { id: string | null; x: number; y: number; text: string; from: Element | null };
/** A group's title being written: of a new group (`id` null) with the frame it will get and the notes it is drawn
 *  around, or of one that exists. */
type Naming = { id: string | null; box: Box; title: string; around: string[]; from: Element | null };
/** What the move mode of the keys carries, and how far the keys have taken it so far: the selected notes, or a
 *  group with its notes, whose size the keys change too. */
type Moving =
  { what: "notes"; ids: ReadonlySet<string>; by: Point } | { what: "group"; id: string; by: Point; grow: Size };
/** What the surface asks before it changes the wall. */
type Asking =
  { about: "note"; id: string; text: string } | { about: "group"; id: string } | { about: "move"; ids: string[] };

type NoteProps = {
  note: Note;
  x: number;
  y: number;
  /** „Deiner“, on the note of the person who looks at it and for nobody else: shown and said */
  own: string | undefined;
  /** „in „Werkzeuge““, for a screen reader */
  where: string | undefined;
  /** it belongs to what the tools act on: the picked notes, or else the current one */
  selected: boolean;
  /** it was picked: the check and the frame of a selected note */
  picked: boolean;
  /** in the move mode: the ink frame of something that is being moved */
  lifted: boolean;
  /** its text is in the field: the field stands in its place */
  writing: boolean;
  /** while an arrangement glides: how long after the first note this one sets out, in milliseconds */
  delay: number | undefined;
};

/** A note on the surface: a card of sebaro, as wide as every note and at least as tall as its text is reckoned
 *  (note-size.ts of the shared rules). A text that needs more room gets it: nothing is ever cut. */
const NoteCard = memo(function NoteCard(props: NoteProps) {
  const { note, x, y, own, where, selected, picked, lifted, writing, delay } = props;
  const place: CSSProperties = { left: rem(x), top: rem(y), minBlockSize: rem(estimateNoteHeight(note.text)) };
  return (
    <div
      className="sb-card sb-card--item app-note"
      id={noteId(note.id)}
      role="option"
      aria-selected={selected}
      data-note={note.id}
      data-picked={picked ? "" : undefined}
      data-lifted={lifted ? "" : undefined}
      data-writing={writing ? "" : undefined}
      style={delay === undefined ? place : { ...place, ["--app-glide-delay" as string]: `${delay}ms` }}
    >
      <p className="app-note__text">
        {note.text}
        {/* in the note's corner, out of the text's flow: the note is as tall as for everybody else */}
        {own !== undefined && (
          <>
            {" "}
            <span className="app-note__own">{own}</span>
          </>
        )}
        {where !== undefined && <span className="sb-visually-hidden"> {where}</span>}
      </p>
      {picked && <Icon name="check--16" size={16} className="app-note__check" />}
    </div>
  );
});

type FrameProps = {
  id: string;
  box: Box;
  /** the title as the wall shows it: its own, or „Ohne Titel“ */
  title: string;
  untitled: boolean;
  /** „Gruppe „Werkzeuge“, 4 Zettel“, for a screen reader */
  label: string;
  lifted: boolean;
  /** its title is in the field: the field stands in its place */
  naming: boolean;
};

/** A group on the surface: a frame without fill with its title at its top (sebaro „Collaboration“). The frame
 *  takes no pointer, so the ground under it still pans; its head is what a pointer takes hold of. */
const GroupFrame = memo(function GroupFrame({ id, box, title, untitled, label, lifted, naming }: FrameProps) {
  return (
    <div
      className="app-group"
      id={frameId(id)}
      role="option"
      aria-selected="false"
      aria-label={label}
      data-group={id}
      data-lifted={lifted ? "" : undefined}
      style={{ left: rem(box.x), top: rem(box.y), inlineSize: rem(box.w), blockSize: rem(box.h) }}
    >
      <p className="app-group__head" data-group-head data-writing={naming ? "" : undefined}>
        <span className="app-group__title" data-untitled={untitled ? "" : undefined} data-sb-truncate>
          {title}
        </span>
      </p>
    </div>
  );
});

type FieldProps = {
  writing: Writing;
  /** the text as it stands in the field: read when the writing ends */
  onText(text: string): void;
  /** the writing ends: saved or left. `byKey`: a key ended it, so the focus has to go somewhere */
  onDone(save: boolean, byKey: boolean): void;
  /** how tall the text field may be, in the world's pixels: what the surface can show at once */
  room(): number;
  /** the field has grown: it may have left the view */
  onGrow(): void;
};

/** The field a note is written in, in the note's place and as wide as a note. Enter saves, Shift and Enter is a new
 *  line, Escape leaves; a press elsewhere saves what stands there. */
function NoteField({ writing, onText, onDone, room, onGrow }: FieldProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(writing.text);
  const field = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    // The focus scrolls the page where it has to: in a window too short for the whole wall, the field comes out
    // from under the action zone. The surface itself has brought the field into its own view already.
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    // The focus alone leaves a field where it stands as long as a part of it shows above the zone (a browser
    // moves a field that is hidden whole, and only nudges one that is hidden in part): the whole note is brought
    // above the zone, by the least way. (jsdom knows no scrolling)
    const card = el.parentElement;
    if (typeof card?.scrollIntoView === "function") card.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, []);
  // The field is as tall as its text, up to what the surface shows at once: a longer text scrolls inside the field,
  // which keeps the caret in view by itself. A browser without `field-sizing` gets the height written.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.maxBlockSize = `${room()}px`;
    if (typeof CSS === "undefined" || !CSS.supports("field-sizing", "content")) {
      el.style.blockSize = "auto";
      el.style.blockSize = `${el.scrollHeight}px`;
    }
    onGrow();
  }, [text, room, onGrow]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onDone(true, true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      // the toast and other layers hear Escape too: this one was the field's
      event.stopPropagation();
      onDone(false, true);
    }
  };

  return (
    <div
      className="sb-card sb-card--item app-note app-note--field"
      id={NOTE_FIELD}
      data-surface-field
      style={{ left: rem(writing.x), top: rem(writing.y), minBlockSize: rem(estimateNoteHeight(writing.text)) }}
    >
      <textarea
        ref={field}
        className="app-note__input"
        id="app-note-text"
        aria-label={t("note.text")}
        aria-describedby={text.length >= LENGTH_FROM ? "app-note-length" : undefined}
        placeholder={t("note.placeholder")}
        maxLength={NOTE_TEXT_MAX}
        rows={3}
        enterKeyHint="done"
        value={text}
        onChange={(event) => {
          onText(event.target.value);
          setText(event.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          // the window lost the focus, not the field: the writing goes on when the person comes back
          if (!document.hasFocus()) return;
          // „Sichern“ and „Abbrechen“ answer for themselves
          if (event.relatedTarget instanceof Element && event.relatedTarget.closest("[data-surface-writing]")) return;
          onDone(true, false);
        }}
      />
      {text.length >= LENGTH_FROM && (
        <p className="app-note__length sb-num" id="app-note-length">
          {t("note.length", { used: text.length, max: NOTE_TEXT_MAX })}
        </p>
      )}
    </div>
  );
}

type TitleProps = {
  naming: Naming;
  onTitle(title: string): void;
  onDone(save: boolean, byKey: boolean): void;
};

/** The field a group's title is written in: the group's frame, with the field in the place of its title. Enter
 *  saves, Escape leaves; a press elsewhere saves what stands there. A title may stay empty. */
function TitleField({ naming, onTitle, onDone }: TitleProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(naming.title);
  const field = useRef<HTMLInputElement>(null);
  const { box } = naming;

  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onDone(true, true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onDone(false, true);
    }
  };

  return (
    <div
      className="app-group app-group--field"
      id={GROUP_FIELD}
      data-surface-field
      style={{ left: rem(box.x), top: rem(box.y), inlineSize: rem(box.w), blockSize: rem(box.h) }}
    >
      <input
        ref={field}
        className="app-group__input"
        id="app-group-title"
        type="text"
        aria-label={t("group.title")}
        placeholder={t("group.placeholder")}
        maxLength={GROUP_TITLE_MAX}
        autoComplete="off"
        enterKeyHint="done"
        value={title}
        onChange={(event) => {
          onTitle(event.target.value);
          setTitle(event.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          if (!document.hasFocus()) return;
          if (event.relatedTarget instanceof Element && event.relatedTarget.closest("[data-surface-writing]")) return;
          onDone(true, false);
        }}
      />
    </div>
  );
}

export const Surface = memo(function Surface({
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
  motion,
}: WallProps) {
  const { t } = useTranslation();
  const frame = useRef<HTMLDivElement>(null);
  const ground = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const over = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLDivElement>(null);

  // An arrangement glides. `motion` reads otherwise: the render that brings the notes' new places also marks the
  // world as gliding, so the places change under a transition (app.css); once every note is there the mark goes.
  // Found while rendering, not in an effect: an effect would come a frame after the places.
  const [glide, setGlide] = useState({ of: motion, on: false });
  if (glide.of !== motion) setGlide({ of: motion, on: true });
  const gliding = useRef(false);
  useLayoutEffect(() => {
    gliding.current = glide.on;
  }, [glide]);
  useEffect(() => {
    if (!glide.on) return;
    // a moment more than the motion takes: a transition that began a frame late is not cut short
    const timer = setTimeout(() => setGlide((now) => ({ ...now, on: false })), GLIDE_MS + GLIDE_STAGGER_MS + 100);
    return () => clearTimeout(timer);
  }, [glide]);
  // the view `lookAt` left: where the surface looked before a proposal's preview took it elsewhere
  const leftView = useRef<View | null>(null);

  // The view, and what turns pixels into units: no state, nothing renders from them.
  const view = useRef<View>({ x: 0, y: 0, zoom: 1 });
  const metric = useRef<{ unit: number; size: Size; left: number; top: number }>({
    unit: 1,
    size: { w: 0, h: 0 },
    left: 0,
    top: 0,
  });
  const rest = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  // the element the mark stands around, and how far a drag has lifted it (world units)
  const marked = useRef<{ id: string | null; lift: Point | null }>({ id: null, lift: null });
  // the frame a dragged note would land in: it carries the mark of a target while the drag lasts
  const target = useRef<string | null>(null);

  const [current, setCurrent] = useState<Current | null>(null);
  // the notes that were picked: with Shift and a press, with the space bar, with Shift and the arrow keys
  const [picked, setPicked] = useState<ReadonlySet<string>>(NOBODY);
  // „Auswählen“ is on: a press on a note picks it, without Shift. The way to select several notes with a finger
  const [choosing, setChoosing] = useState(false);
  const [writing, setWriting] = useState<Writing | null>(null);
  const [naming, setNaming] = useState<Naming | null>(null);
  const [moving, setMoving] = useState<Moving | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  // the line that names the keys: shown when its key in the tools was pressed
  const [legend, setLegend] = useState(false);
  const draft = useRef("");
  // The note and the title being written and what is being moved, as the handlers see them: ending any of them
  // moves the focus, and the blur that follows asks to end it once more, from a render that still holds the old
  // state. The refs say that it is over.
  const open = useRef<Writing | null>(null);
  const named = useRef<Naming | null>(null);
  const carried = useRef<Moving | null>(null);
  const write = (next: Writing | null) => {
    open.current = next;
    setWriting(next);
  };
  const name = (next: Naming | null) => {
    named.current = next;
    setNaming(next);
  };
  const carry = (next: Moving | null) => {
    carried.current = next;
    setMoving(next);
  };

  // Where the page stood before a field moved it. The surface brings the field into its own view, and where the
  // whole wall is in the window the page does not move for it. In a window too short for the wall, or on a phone
  // whose keyboard takes half of it, the browser moves the page to show the field that takes the focus: when a key
  // or a tool ends the writing, the page goes back to where it stood, so the wall's head is not left out of view.
  // A press elsewhere ends the writing too, and there the page stays (it must not move under the pointer); `left`
  // is where it was left then, so a field that opens right there, with the same press, still knows the way back.
  const pageAt = useRef<{ home: number; left: number | null } | null>(null);
  const keepPage = () => {
    const at = window.scrollY;
    const before = pageAt.current;
    pageAt.current = { home: before !== null && before.left === at ? before.home : at, left: null };
  };
  const restorePage = (byKey: boolean) => {
    const before = pageAt.current;
    const at = window.scrollY;
    if (before === null) return;
    if (at === before.home) pageAt.current = null;
    else if (!byKey) pageAt.current = { home: before.home, left: at };
    else {
      pageAt.current = null;
      window.scrollTo({ top: before.home, behavior: "instant" });
    }
  };

  const byId = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);

  // a note or a group somebody deleted is no longer the current one, nor picked, nor the one that moves
  const currentNote = current?.kind === "note" ? byId.get(current.id) : undefined;
  const currentGroup = current?.kind === "group" ? groupById.get(current.id) : undefined;
  const pickedNotes = useMemo(() => notes.filter((note) => picked.has(note.id)), [notes, picked]);
  // what the tools and the move mode act on: the picked notes, or else the current one
  const selected = useMemo(
    () => (pickedNotes.length > 0 ? pickedNotes : currentNote ? [currentNote] : []),
    [pickedNotes, currentNote],
  );
  const several = selected.length > 1;
  const members = useMemo(() => {
    const count = new Map<string, number>();
    for (const note of notes) if (note.groupId !== null) count.set(note.groupId, (count.get(note.groupId) ?? 0) + 1);
    return count;
  }, [notes]);
  // what the keys carry, while it is still on the wall
  const lifted =
    moving === null
      ? null
      : moving.what === "group"
        ? groupById.has(moving.id)
          ? moving
          : null
        : notes.some((note) => moving.ids.has(note.id))
          ? moving
          : null;

  /** Stands the mark around the current note or group, or around the field while something is written: a frame of
   *  constant width at every zoom, drawn on the surface and not in the world. */
  const placeMark = () => {
    const el = mark.current;
    if (!el) return;
    const { id, lift } = marked.current;
    // while an arrangement glides the note is on its way: the mark waits until it has arrived
    const around = id === null || gliding.current ? null : document.getElementById(id);
    if (around === null) {
      el.hidden = true;
      return;
    }
    const { unit } = metric.current;
    const { x, y, zoom } = view.current;
    const left = x * unit + (around.offsetLeft + (lift?.x ?? 0) * unit) * zoom;
    const top = y * unit + (around.offsetTop + (lift?.y ?? 0) * unit) * zoom;
    el.hidden = false;
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    el.style.inlineSize = `${Math.round(around.offsetWidth * zoom)}px`;
    el.style.blockSize = `${Math.round(around.offsetHeight * zoom)}px`;
  };

  /** Shows a view: one transform for the world and the layer above it. Nothing renders. */
  const show = (next: View) => {
    view.current = next;
    const { unit } = metric.current;
    const transform = `translate(${Math.round(next.x * unit)}px, ${Math.round(next.y * unit)}px) scale(${next.zoom})`;
    if (world.current) world.current.style.transform = transform;
    if (over.current) over.current.style.transform = transform;
    placeMark();
    // While the view moves the world is a layer of its own, which the browser moves without drawing it again;
    // at rest it is drawn sharp at its new size, and the frames of the picked notes get the width of a line
    // again, whatever the zoom (the zoom is told to the world only then: it restyles every note).
    frame.current?.setAttribute("data-moving", "");
    clearTimeout(rest.current);
    rest.current = setTimeout(() => {
      frame.current?.removeAttribute("data-moving");
      world.current?.style.setProperty("--app-zoom", String(view.current.zoom));
    }, REST_MS);
  };

  /** Reads the surface's size and place, and what a unit is in pixels (1/16 of the root's text size). */
  const measure = () => {
    const el = frame.current;
    if (!el) return;
    const unit = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1;
    const box = el.getBoundingClientRect();
    metric.current = {
      unit,
      size: { w: el.clientWidth / unit, h: el.clientHeight / unit },
      left: box.left + el.clientLeft,
      top: box.top + el.clientTop,
    };
  };
  /** A pointer's place on the surface, in units. */
  const where = (event: { clientX: number; clientY: number }): Point => {
    const { unit, left, top } = metric.current;
    return { x: (event.clientX - left) / unit, y: (event.clientY - top) / unit };
  };
  const middle = (): Point => ({ x: metric.current.size.w / 2, y: metric.current.size.h / 2 });

  // „Alles zeigen“ shows the notes and the frames: an empty group is part of the wall too
  const fitAll = () => show(fit(everything(notes, groups), metric.current.size));
  const zoomBy = (factor: number) => show(zoomAt(view.current, middle(), view.current.zoom * factor));

  // The first look: everything, before the first paint. From then on the view is the person's own.
  const fitted = useRef(false);
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const look = () => {
      const before = metric.current.size;
      measure();
      const { size, unit } = metric.current;
      if (!fitted.current && size.w > 0 && size.h > 0) {
        fitted.current = true;
        fitAll();
        world.current?.style.setProperty("--app-zoom", String(view.current.zoom));
        return;
      }
      // The surface has another size (the window, the line of keys opening under it): what the mark stands
      // around stays in view if it was. The unit may have changed too: the view is written anew either way.
      let next = view.current;
      const around = marked.current.id === null ? null : document.getElementById(marked.current.id);
      if (around !== null) {
        const box = {
          x: around.offsetLeft / unit,
          y: around.offsetTop / unit,
          w: around.offsetWidth / unit,
          h: around.offsetHeight / unit,
        };
        if (reveal(next, before, box) === next) next = reveal(next, size, box);
      }
      show(next);
    };
    look();
    const observer = new ResizeObserver(look);
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(rest.current);
    };
    // once: the surface is fitted when it arrives, never again by itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The wheel pans, and with Strg or ⌘ (a pinch on a trackpad arrives so) zooms around the pointer. Not passive:
  // the page must not scroll or zoom under it.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const zooms = event.ctrlKey || event.metaKey;
      // while the page itself is zoomed, a pinch is the page's: taking it here would leave no way back out
      if (zooms && (window.visualViewport?.scale ?? 1) > 1.001) return;
      event.preventDefault();
      measure();
      const { unit, size } = metric.current;
      // pixels in Chromium; lines for a Firefox mouse wheel, pages for some devices
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.h * unit : 1;
      if (zooms) show(zoomAt(view.current, where(event), wheelZoom(view.current.zoom, event.deltaY * scale)));
      else show(panBy(view.current, (-event.deltaX * scale) / unit, (-event.deltaY * scale) / unit));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // the handler reads refs alone
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the mark follows what was rendered: another current note or group, one that moved or grew, a field
  useLayoutEffect(() => {
    marked.current.id =
      writing !== null
        ? NOTE_FIELD
        : naming !== null
          ? GROUP_FIELD
          : currentNote
            ? noteId(currentNote.id)
            : currentGroup
              ? frameId(currentGroup.id)
              : null;
    placeMark();
  });

  /** The part of a frame's head its title stands in: what is brought into view for the title's field, and where
   *  the arrow keys set out from a group. */
  const headOf = (box: Box): Box => ({ x: box.x, y: box.y, w: Math.min(box.w, TITLE_ROOM), h: GROUP_HEAD });

  /** Brings a box of the world into view; a view that shows it stays as it is. */
  const follow = (box: Box) => {
    const next = reveal(view.current, metric.current.size, box);
    if (next !== view.current) show(next);
  };

  // ───────────────────────── selecting ─────────────────────────

  /** The picked notes with this one added, or taken out again: the space bar, and a press with Shift. */
  const toggled = (note: Note): Set<string> => {
    const chosen = new Set(pickedNotes.map((one) => one.id));
    if (chosen.has(note.id)) chosen.delete(note.id);
    else chosen.add(note.id);
    return chosen;
  };
  const sayPicked = (count: number) => say(count === 0 ? t("surface.cleared") : t("surface.selected", { count }));
  /** The selection is put away, and „Auswählen“ with it: on a phone its key is out of sight while several notes
   *  are selected. */
  const clearPicked = () => {
    setPicked(NOBODY);
    setChoosing(false);
    say(t("surface.cleared"));
  };

  // ───────────────────────── moving ─────────────────────────

  /** One `notes.move` for the notes that go somewhere: where a drag ends, the move mode, „Verschieben nach …“. The
   *  result is said once, for all of them: into which group they went, or that they were put down. */
  const moveNotes = (moves: NoteMove[], putDown: boolean) => {
    const real = changing(moves, byId);
    if (real.length > 0) send({ type: "notes.move", opId: generateHexId(), moves: real });
    const told =
      toldOfMove(t, byId, real, groups) ??
      (putDown ? (moves.length === 1 ? t("surface.moved") : t("surface.movedSeveral", { count: moves.length })) : null);
    if (told !== null) say(told);
  };

  /** A frame at another place or of another size: one `group.update` with what changed, and one `notes.move` for
   *  the notes that go with it, leave it or join it. */
  const reframe = (group: Group, to: Box) => {
    const change: { x?: number; y?: number; w?: number; h?: number } = {};
    for (const side of ["x", "y", "w", "h"] as const) if (to[side] !== group[side]) change[side] = to[side];
    if (Object.keys(change).length === 0) return;
    send({ type: "group.update", opId: generateHexId(), groupId: group.id, ...change });
    const moves = reframed(group, to, notes, groups);
    if (moves.length > 0) send({ type: "notes.move", opId: generateHexId(), moves });
  };

  /** Where the group the keys carry lies now. */
  const carriedBox = (group: Group, now: Extract<Moving, { what: "group" }>): Box =>
    framed({ x: group.x + now.by.x, y: group.y + now.by.y, w: group.w + now.grow.w, h: group.h + now.grow.h });

  const startMoving = () => {
    if (currentGroup) {
      carry({ what: "group", id: currentGroup.id, by: NOWHERE, grow: { w: 0, h: 0 } });
      say(t("surface.movingGroup"));
    } else if (selected.length > 0) {
      carry({ what: "notes", ids: new Set(selected.map((note) => note.id)), by: NOWHERE });
      say(several ? t("surface.movingSeveral", { count: selected.length }) : t("surface.moving"));
    }
  };
  /** The move mode ends: what the keys carried stays where they put it, and the wall is told once. */
  const drop = () => {
    const now = carried.current;
    if (now === null) return;
    carry(null);
    if (now.what === "group") {
      const group = groupById.get(now.id);
      if (group === undefined) return;
      reframe(group, carriedBox(group, now));
      say(t("surface.movedGroup"));
      return;
    }
    const moved = notes.filter((note) => now.ids.has(note.id));
    if (moved.length > 0) moveNotes(shifted(moved, now.by, groups), true);
  };
  const cancelMoving = () => {
    const now = carried.current;
    if (now === null) return;
    carry(null);
    say(t(now.what === "notes" && now.ids.size === 1 ? "surface.moveCancelled" : "surface.moveCancelledAll"));
  };

  /** „Verschieben nach …“ was answered: the notes go to free places inside the group, which grows where it has to,
   *  or to free places outside every frame. */
  const moveInto = (ids: string[], to: string | null) => {
    const target = to === null ? null : groupById.get(to);
    if (target === undefined) return;
    measure();
    const chosen = notes.filter((note) => ids.includes(note.id));
    const { moves, frame: grown } = movedTo(chosen, target, notes, groups, visible(view.current, metric.current.size));
    if (moves.length === 0) return;
    if (target !== null && grown !== null) {
      send({ type: "group.update", opId: generateHexId(), groupId: target.id, w: grown.w, h: grown.h });
    }
    moveNotes(moves, false);
    // the view goes where the notes went: the current one, or the first of them
    const shown = moves.find((move) => move.noteId === currentNote?.id) ?? moves[0];
    const note = shown && byId.get(shown.noteId);
    if (shown && note) follow({ ...boxOf(note), x: shown.x, y: shown.y });
  };

  // ───────────────────────── writing ─────────────────────────

  /** The view something is written in: at life size at least, so the field is a field. */
  const forWriting = (at: Point): View => (view.current.zoom < 1 ? zoomAt(view.current, at, 1) : view.current);

  const endWriting = (save: boolean, byKey: boolean) => {
    const written = open.current;
    if (written === null) return;
    write(null);
    const text = draft.current.trim();
    if (save && text !== "") {
      if (written.id === null) {
        // where its field stood, if the text it got still fits there; else the nearest free place
        const size = sizeOf(text);
        const spot = freeSpot(size, notes.map(boxOf), visible(view.current, metric.current.size), {
          x: written.x + size.w / 2,
          y: written.y + size.h / 2,
        });
        const id = generateHexId();
        send({ type: "note.create", opId: generateHexId(), noteId: id, text, x: spot.x, y: spot.y });
        // a note is made without a group: one that lies in a frame is told to belong to it
        const groupId = groupOf({ ...spot, ...size }, groups);
        if (groupId !== null) {
          send({ type: "notes.move", opId: generateHexId(), moves: [{ noteId: id, ...spot, groupId }] });
        }
        setCurrent({ kind: "note", id });
      } else if (text !== written.text) {
        send({ type: "note.update", opId: generateHexId(), noteId: written.id, text });
      }
    }
    // A press elsewhere ended the writing: the focus is where the person put it. A key ended it: after saving the
    // surface has the focus, with the note as the current one; after leaving, whatever had it before.
    if (byKey) {
      const back = !save && written.from instanceof HTMLElement && written.from.isConnected ? written.from : null;
      (back ?? ground.current)?.focus({ preventScroll: true });
    }
    restorePage(byKey);
  };

  const endNaming = (save: boolean, byKey: boolean) => {
    const titled = named.current;
    if (titled === null) return;
    name(null);
    const title = draft.current.trim().slice(0, GROUP_TITLE_MAX);
    if (save) {
      if (titled.id === null) {
        const id = generateHexId();
        const { x, y, w, h } = titled.box;
        send({ type: "group.create", opId: generateHexId(), groupId: id, title, x, y, w, h });
        // the notes it was drawn around belong to it, and so does every note without a group that lies in it
        const frames = [...groups, { id, x, y, w, h }];
        const moves = notes
          .filter(
            (note) =>
              note.groupId !== id &&
              (titled.around.includes(note.id) || (note.groupId === null && groupOf(boxOf(note), frames) === id)),
          )
          .map((note) => ({ noteId: note.id, x: note.x, y: note.y, groupId: id }));
        if (moves.length > 0) send({ type: "notes.move", opId: generateHexId(), moves });
        setPicked(NOBODY);
        setChoosing(false);
        setCurrent({ kind: "group", id });
        say(moves.length > 0 ? t("group.madeAround", { count: moves.length }) : t("group.made"));
      } else if (title !== titled.title) {
        send({ type: "group.update", opId: generateHexId(), groupId: titled.id, title });
      }
    }
    if (byKey) {
      const back = !save && titled.from instanceof HTMLElement && titled.from.isConnected ? titled.from : null;
      (back ?? ground.current)?.focus({ preventScroll: true });
    }
    restorePage(byKey);
  };

  const compose = (at?: Point) => {
    if (paused) return;
    if (notes.length >= MAX_NOTES) {
      onRefuse({ code: "LIMIT", command: "note.create" });
      return;
    }
    measure();
    const { size } = metric.current;
    const point = at ?? middle();
    const next = forWriting(point);
    const empty = sizeOf("");
    // A place that was pointed at is taken as it is, also inside a frame: the note then belongs to that group. A
    // place the surface chooses lies outside every frame, where a note has no group.
    const taken = at === undefined ? [...notes.map(boxOf), ...groups] : notes.map(boxOf);
    const spot = freeSpot(empty, taken, visible(next, size), toWorld(next, point));
    show(reveal(next, size, { ...spot, ...empty }));
    draft.current = "";
    drop();
    endNaming(true, false);
    setPicked(NOBODY);
    setCurrent(null);
    keepPage();
    write({ id: null, ...spot, text: "", from: document.activeElement });
  };

  const edit = (note: Note) => {
    if (!mayEditNote(note)) {
      onRefuse({ code: "NOT_AUTHOR", command: "note.update" });
      return;
    }
    measure();
    const box = boxOf(note);
    const next = forWriting(toSurface(view.current, middleOf(box)));
    show(reveal(next, metric.current.size, box));
    draft.current = note.text;
    drop();
    endNaming(true, false);
    setCurrent({ kind: "note", id: note.id });
    keepPage();
    write({ id: note.id, x: note.x, y: note.y, text: note.text, from: document.activeElement });
  };

  // ───────────────────────── groups ─────────────────────────

  /** Opens the field for a group's title: the view goes to life size at the frame's head. */
  const startNaming = (next: Naming) => {
    const head = headOf(next.box);
    show(reveal(forWriting(toSurface(view.current, middleOf(head))), metric.current.size, head));
    draft.current = next.title;
    drop();
    endWriting(true, false);
    keepPage();
    name(next);
  };

  /** „Neue Gruppe“: a frame around the picked notes, or else at a free place in view, with the field for its title
   *  open. The group is made when the title is saved, as a note is. */
  const newGroup = () => {
    if (paused) return;
    if (groups.length >= MAX_GROUPS) {
      onRefuse({ code: "LIMIT", command: "group.create" });
      return;
    }
    measure();
    let box: Box;
    if (pickedNotes.length > 0) {
      box = frameAround(pickedNotes.map(boxOf));
    } else {
      const next = forWriting(middle());
      const taken = [...notes.map(boxOf), ...groups];
      const spot = freeSpot(NEW_GROUP, taken, visible(next, metric.current.size), toWorld(next, middle()));
      box = { ...spot, ...NEW_GROUP };
    }
    setCurrent(null);
    startNaming({
      id: null,
      box,
      title: "",
      around: pickedNotes.map((note) => note.id),
      from: document.activeElement,
    });
  };

  const rename = (group: Group) => {
    measure();
    setCurrent({ kind: "group", id: group.id });
    startNaming({ id: group.id, box: group, title: group.title, around: [], from: document.activeElement });
  };

  useImperativeHandle(ref, () => ({
    compose: () => compose(),
    group: () => newGroup(),
    lookAt: (box, remember) => {
      measure();
      leftView.current = remember ? view.current : null;
      show(fit(box, metric.current.size));
    },
    lookBack: () => {
      const back = leftView.current;
      leftView.current = null;
      if (back === null) return;
      measure();
      show(back);
    },
    focus: () => ground.current?.focus({ preventScroll: true }),
  }));

  // ───────────────────────── deleting ─────────────────────────

  const askDelete = (note: Note) => {
    if (!mayDeleteNote(note, you)) {
      onRefuse({ code: "NOT_AUTHOR", command: "note.delete" });
      return;
    }
    drop();
    setAsking({ about: "note", id: note.id, text: quoted(note.text) });
  };
  const askDeleteGroup = (group: Group) => {
    drop();
    setAsking({ about: "group", id: group.id });
  };
  const askMove = () => {
    if (selected.length === 0 || groups.length === 0) return;
    drop();
    setAsking({ about: "move", ids: selected.map((note) => note.id) });
  };

  // ───────────────────────── keys ─────────────────────────

  /** The notes as the boxes the arrow keys go between. */
  const boxes = () => notes.map((note) => ({ id: note.id, ...boxOf(note) }));

  /** The note an arrow key leads to: from the current note the nearest one that way; from the current group the
   *  nearest one seen from its title, so the arrow down leads into the group; with nothing current, the one
   *  nearest to the middle of the view. */
  const towards = (direction: Direction) => {
    const all = boxes();
    if (all.length === 0) return null;
    const from = currentNote
      ? { id: currentNote.id, ...boxOf(currentNote) }
      : currentGroup && { id: currentGroup.id, ...headOf(currentGroup) };
    if (from !== undefined) return nearestInDirection(from, all, direction);
    const at = toWorld(view.current, middle());
    const far = (box: Box) => Math.hypot(box.x + box.w / 2 - at.x, box.y + box.h / 2 - at.y);
    return all.reduce((best, box) => (far(box) < far(best) ? box : best));
  };

  const jump = (direction: Direction, extend: boolean) => {
    const next = towards(direction);
    if (next === null) return;
    if (extend) {
      // Shift takes the note that is left and the note that is reached into the selection
      const chosen = new Set(pickedNotes.map((note) => note.id));
      if (currentNote) chosen.add(currentNote.id);
      chosen.add(next.id);
      setPicked(chosen);
      sayPicked(chosen.size);
    }
    setCurrent({ kind: "note", id: next.id });
    follow(next);
  };

  /** G: the next group in the order they were made, Shift and G the one before. From a note, its own group first;
   *  from nothing, the first group. */
  const jumpGroup = (back: boolean) => {
    if (groups.length === 0) return;
    const at = currentGroup ? groups.indexOf(currentGroup) : -1;
    const ownId = currentNote?.groupId ?? null;
    const own = ownId === null ? undefined : groupById.get(ownId);
    const next =
      at >= 0
        ? groups[(at + (back ? groups.length - 1 : 1)) % groups.length]
        : (own ?? (back ? groups[groups.length - 1] : groups[0]));
    if (next === undefined) return;
    setCurrent({ kind: "group", id: next.id });
    follow(next);
  };

  /** One step of the move mode: the arrow keys move what is carried; with Shift they change a group's size. */
  const step = (now: Moving, direction: Direction, resize: boolean) => {
    if (now.what === "notes") {
      const by = stepped(now.by, direction);
      carry({ ...now, by });
      const lead =
        currentNote && now.ids.has(currentNote.id) ? currentNote : notes.find((note) => now.ids.has(note.id));
      if (lead) follow({ ...boxOf(lead), x: lead.x + by.x, y: lead.y + by.y });
      return;
    }
    const group = groupById.get(now.id);
    if (group === undefined) return;
    let next: Extract<Moving, { what: "group" }>;
    if (resize) {
      const sign = direction === "left" || direction === "up" ? -1 : 1;
      const wide = direction === "left" || direction === "right";
      const sized = framed({
        ...group,
        w: group.w + now.grow.w + (wide ? sign * STEP : 0),
        h: group.h + now.grow.h + (wide ? 0 : sign * STEP),
      });
      next = { ...now, grow: { w: sized.w - group.w, h: sized.h - group.h } };
    } else {
      next = { ...now, by: stepped(now.by, direction) };
    }
    carry(next);
    const box = carriedBox(group, next);
    // while its size changes the corner that moves stays in view, else its head
    follow(resize ? { x: box.x + box.w - STEP, y: box.y + box.h - STEP, w: STEP, h: STEP } : headOf(box));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    // a chord is the browser's (Strg and Minus zooms the page), and a key held down says nothing new
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const direction = ARROWS[event.key];
    if (direction !== undefined) {
      event.preventDefault();
      measure();
      if (lifted !== null) step(lifted, direction, event.shiftKey);
      else jump(direction, event.shiftKey && !paused);
      return;
    }
    // while the wall is paused the keys look and change nothing
    if (paused && !LOOKING.has(event.key)) {
      // (the page must not scroll under the space bar)
      if (event.key === " ") event.preventDefault();
      return;
    }
    switch (event.key) {
      case "Enter":
        event.preventDefault();
        if (lifted !== null) drop();
        else if (currentNote) edit(currentNote);
        else if (currentGroup) rename(currentGroup);
        return;
      case " ":
        // the page must not scroll under the space bar
        event.preventDefault();
        if (lifted !== null || !currentNote) return;
        {
          const chosen = toggled(currentNote);
          setPicked(chosen);
          sayPicked(chosen.size);
        }
        return;
      case "Escape":
        if (lifted !== null) {
          event.preventDefault();
          event.stopPropagation();
          cancelMoving();
        } else if (pickedNotes.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          clearPicked();
        }
        return;
      case "m":
      case "M":
        if (lifted !== null) drop();
        else startMoving();
        return;
      case "v":
      case "V":
        askMove();
        return;
      case "g":
      case "G":
        if (lifted !== null) return;
        measure();
        jumpGroup(event.shiftKey);
        return;
      case "n":
      case "N":
        event.preventDefault();
        compose();
        return;
      case "Delete":
      case "Backspace":
        if (currentNote) askDelete(currentNote);
        else if (currentGroup) askDeleteGroup(currentGroup);
        return;
      case "+":
      case "=":
        measure();
        zoomBy(ZOOM_STEP);
        return;
      case "-":
      case "_":
        measure();
        zoomBy(1 / ZOOM_STEP);
        return;
      case "0":
        measure();
        fitAll();
        return;
    }
  };

  // ───────────────────────── pointers ─────────────────────────

  /** The frame a dragged note would land in carries the mark of a target; another one, or none, takes it off. */
  const aim = (groupId: string | null) => {
    if (target.current === groupId) return;
    if (target.current !== null) document.getElementById(frameId(target.current))?.removeAttribute("data-target");
    if (groupId !== null) document.getElementById(frameId(groupId))?.setAttribute("data-target", "");
    target.current = groupId;
  };

  /** A gesture that was taken away (a second finger, the browser): nothing of it stays. */
  const abandon = () => {
    const now = gesture.current;
    gesture.current = null;
    if (now === null || now.kind === "pan" || now.kind === "pinch") return;
    for (const el of now.kind === "drag" ? now.els : [now.el, ...now.els]) {
      el.style.transform = "";
      el.removeAttribute("data-lifted");
    }
    if (now.kind === "frame" && now.size) {
      now.el.style.inlineSize = rem(now.group.w);
      now.el.style.blockSize = rem(now.group.h);
    }
    aim(null);
    marked.current.lift = null;
    placeMark();
  };

  /** A press on a note: it is the current one, and a drag will move it, with the selection it belongs to. */
  const pressNote = (event: PointerEvent, note: Note, at: Point) => {
    // the move mode of the keys ends here
    drop();
    let dragged: Note[];
    let reduce = false;
    let unpick = false;
    if (choosing && !event.shiftKey) {
      // „Auswählen“ is on: a press takes the note into the selection. One that is in it already goes with the
      // others when it is dragged, and leaves the selection when the press ends without a drag
      if (picked.has(note.id)) {
        dragged = pickedNotes;
        unpick = true;
      } else {
        const chosen = new Set(pickedNotes.map((one) => one.id)).add(note.id);
        setPicked(chosen);
        sayPicked(chosen.size);
        dragged = notes.filter((one) => chosen.has(one.id));
      }
    } else if (event.shiftKey) {
      // Shift takes the note into the selection, or out of it again; the note that was the current one stays in
      const chosen = toggled(note);
      if (pickedNotes.length === 0 && currentNote && currentNote.id !== note.id) chosen.add(currentNote.id);
      setPicked(chosen);
      sayPicked(chosen.size);
      dragged = chosen.has(note.id) ? notes.filter((one) => chosen.has(one.id)) : [];
    } else if (pickedNotes.length > 1 && picked.has(note.id)) {
      // one of several picked notes: a drag moves them all, a press alone leaves this one
      dragged = pickedNotes;
      reduce = true;
    } else {
      if (pickedNotes.length > 0) setPicked(NOBODY);
      dragged = [note];
    }
    setCurrent({ kind: "note", id: note.id });
    const pairs = dragged.flatMap((one) => {
      const el = document.getElementById(noteId(one.id));
      return el ? [{ note: one, el }] : [];
    });
    if (pairs.length === 0) return;
    gesture.current = {
      kind: "drag",
      pointer: event.pointerId,
      from: at,
      pressed: note,
      notes: pairs.map((pair) => pair.note),
      els: pairs.map((pair) => pair.el),
      lift: NOWHERE,
      moved: false,
      reduce,
      unpick,
    };
  };

  /** A press on a group's head, or on the handle of the current group: the group is the current one, a drag moves
   *  it with its notes, or changes its size. */
  const pressFrame = (event: PointerEvent, group: Group, at: Point, size: boolean) => {
    drop();
    if (pickedNotes.length > 0) setPicked(NOBODY);
    setCurrent({ kind: "group", id: group.id });
    const el = document.getElementById(frameId(group.id));
    if (!el) return;
    const els = size
      ? []
      : notes.flatMap((note) => {
          const one = note.groupId === group.id ? document.getElementById(noteId(note.id)) : null;
          return one ? [one] : [];
        });
    gesture.current = {
      kind: "frame",
      pointer: event.pointerId,
      from: at,
      group,
      el,
      els,
      size,
      lift: NOWHERE,
      moved: false,
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const pressed = event.target as Element;
    // the field takes its own pointers: a press in it places the caret
    if (pressed.closest("[data-surface-field]")) return;
    // a first pointer: whatever an earlier one left behind is over
    if (event.isPrimary) pointers.current.clear();
    measure();
    const at = where(event);
    pointers.current.set(event.pointerId, at);
    if (pointers.current.size === 2) {
      // a second finger: two fingers pan and zoom, whatever the first one had begun
      abandon();
      const [first, second] = [...pointers.current.entries()] as [[number, Point], [number, Point]];
      gesture.current = {
        kind: "pinch",
        pointers: [first[0], second[0]],
        from: [first[1], second[1]],
        view: view.current,
      };
      return;
    }
    if (pointers.current.size > 2) return;
    // while the wall is paused every press is the ground's: it pans, and takes hold of nothing
    if (paused) {
      gesture.current = { kind: "pan", pointer: event.pointerId, from: at, view: view.current, moved: false };
      return;
    }
    const id = pressed.closest<HTMLElement>("[data-note]")?.dataset.note;
    const note = id === undefined ? undefined : byId.get(id);
    if (note) {
      pressNote(event, note, at);
      return;
    }
    if (currentGroup && pressed.closest("[data-surface-handle]")) {
      pressFrame(event, currentGroup, at, true);
      return;
    }
    const head = pressed.closest("[data-group-head]")?.closest<HTMLElement>("[data-group]")?.dataset.group;
    const group = head === undefined ? undefined : groupById.get(head);
    if (group) pressFrame(event, group, at, false);
    else gesture.current = { kind: "pan", pointer: event.pointerId, from: at, view: view.current, moved: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    const at = where(event);
    pointers.current.set(event.pointerId, at);
    const now = gesture.current;
    if (now === null) return;
    if (now.kind === "pinch") {
      const first = pointers.current.get(now.pointers[0]);
      const second = pointers.current.get(now.pointers[1]);
      if (first && second) show(pinch(now.view, now.from, [first, second]));
      return;
    }
    if (now.pointer !== event.pointerId) return;
    const { unit } = metric.current;
    const dx = at.x - now.from.x;
    const dy = at.y - now.from.y;
    if (!now.moved) {
      if (Math.hypot(dx, dy) * unit < DRAG_FROM) return;
      now.moved = true;
      // from here on the pointer is the surface's, also outside it
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // a pointer of a test may refuse: the drag works all the same
      }
      event.currentTarget.setAttribute("data-dragging", "");
      if (now.kind === "drag") for (const el of now.els) el.setAttribute("data-lifted", "");
      if (now.kind === "frame") for (const el of [now.el, ...now.els]) el.setAttribute("data-lifted", "");
    }
    if (now.kind === "pan") {
      show(panBy(now.view, dx, dy));
      return;
    }
    // what is dragged follows the pointer: a transform of its own, in the world's size
    const { zoom } = view.current;
    now.lift = { x: dx / zoom, y: dy / zoom };
    const move = `translate(${now.lift.x * unit}px, ${now.lift.y * unit}px)`;
    if (now.kind === "drag") {
      for (const el of now.els) el.style.transform = move;
      const box = boxOf(now.pressed);
      aim(groupOf({ ...box, x: box.x + now.lift.x, y: box.y + now.lift.y }, groups));
      marked.current.lift = now.lift;
    } else if (now.size) {
      const { group } = now;
      const to = framed({ x: group.x, y: group.y, w: group.w + now.lift.x, h: group.h + now.lift.y });
      now.el.style.inlineSize = rem(to.w);
      now.el.style.blockSize = rem(to.h);
    } else {
      for (const el of [now.el, ...now.els]) el.style.transform = move;
      marked.current.lift = now.lift;
    }
    placeMark();
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    event.currentTarget.removeAttribute("data-dragging");
    const now = gesture.current;
    if (now === null) return;
    if (now.kind === "pinch") {
      // one finger stays: it does nothing more until it is lifted
      if (now.pointers.includes(event.pointerId)) gesture.current = null;
      return;
    }
    if (now.pointer !== event.pointerId) return;
    gesture.current = null;
    if (now.kind === "pan") {
      // a press on the bare ground: nothing is the current one, nothing is picked
      if (!now.moved) {
        setCurrent(null);
        if (pickedNotes.length > 0) setPicked(NOBODY);
      }
      return;
    }
    if (!now.moved) {
      if (now.kind === "drag" && now.reduce) setPicked(NOBODY);
      if (now.kind === "drag" && now.unpick) {
        const chosen = toggled(now.pressed);
        setPicked(chosen);
        sayPicked(chosen.size);
      }
      return;
    }
    aim(null);
    marked.current.lift = null;
    if (now.kind === "drag") {
      // The notes lie at their new places at once: the same places React writes a moment later, when the command
      // has been applied. Without this they would jump back for one frame.
      const moves = shifted(now.notes, now.lift, groups);
      for (const [n, el] of now.els.entries()) {
        const to = moves[n];
        el.style.transform = "";
        el.removeAttribute("data-lifted");
        if (to === undefined) continue;
        el.style.left = rem(to.x);
        el.style.top = rem(to.y);
      }
      placeMark();
      moveNotes(moves, false);
      return;
    }
    const { group } = now;
    const to = now.size
      ? framed({ x: group.x, y: group.y, w: group.w + now.lift.x, h: group.h + now.lift.y })
      : framed({ x: group.x + now.lift.x, y: group.y + now.lift.y, w: group.w, h: group.h });
    for (const el of [now.el, ...now.els]) {
      el.style.transform = "";
      el.removeAttribute("data-lifted");
    }
    now.el.style.left = rem(to.x);
    now.el.style.top = rem(to.y);
    now.el.style.inlineSize = rem(to.w);
    now.el.style.blockSize = rem(to.h);
    for (const move of reframed(group, to, notes, groups)) {
      const el = document.getElementById(noteId(move.noteId));
      if (!el) continue;
      el.style.left = rem(move.x);
      el.style.top = rem(move.y);
    }
    placeMark();
    reframe(group, to);
  };

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    event.currentTarget.removeAttribute("data-dragging");
    abandon();
  };

  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const pressed = event.target as Element;
    if (paused || pressed.closest("[data-surface-field], [data-surface-handle]")) return;
    const id = pressed.closest<HTMLElement>("[data-note]")?.dataset.note;
    const note = id === undefined ? undefined : byId.get(id);
    const head = pressed.closest("[data-group-head]")?.closest<HTMLElement>("[data-group]")?.dataset.group;
    const group = head === undefined ? undefined : groupById.get(head);
    // while „Auswählen“ is on, two presses on a note pick it and take it out again: they open no field
    if (note && choosing) return;
    measure();
    if (note) edit(note);
    else if (group) rename(group);
    else compose(where(event));
  };

  // The wall is paused: whatever this person had begun ends as a press elsewhere ends it. What stands in a field is
  // saved, what the keys carried is put down, a gesture is let go; and nothing stays selected.
  const [rested, setRested] = useState(paused);
  if (rested !== paused) {
    setRested(paused);
    if (paused) {
      setPicked(NOBODY);
      setChoosing(false);
    }
  }
  useEffect(() => {
    if (!paused) return;
    endWriting(true, false);
    endNaming(true, false);
    drop();
    abandon();
    // once, when the pause begins: the handlers are the ones of that render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // a button of the tools must not take the focus out of the field before its press arrives: the field would save
  const keepFocus = (event: PointerEvent) => event.preventDefault();
  const fielded = writing !== null || naming !== null;
  const endField = (save: boolean) => {
    if (open.current !== null) endWriting(save, true);
    else endNaming(save, true);
  };
  // the one group every selected note lies in, or none (null), or not the same for all (undefined)
  const from = selected.every((note) => note.groupId === selected[0]?.groupId) ? selected[0]?.groupId : undefined;
  const movingKeys =
    lifted === null
      ? t("surface.keys")
      : lifted.what === "group"
        ? t("surface.movingGroup")
        : lifted.ids.size > 1
          ? t("surface.movingSeveral", { count: lifted.ids.size })
          : t("surface.moving");
  const moveTool = groups.length > 0 && (
    <button className="sb-text-action app-tool" type="button" onClick={askMove}>
      <Icon name="move-to-folder" />
      <span className="app-tool__word">{t("note.move")}</span>
    </button>
  );
  const askedGroup = asking?.about === "group" ? groupById.get(asking.id) : undefined;

  return (
    <>
      <section className="app-surface" aria-label={t("surface.label")}>
        <div
          className="app-surface__tools"
          role="group"
          aria-label={t("surface.tools")}
          data-writing={fielded ? "" : undefined}
          data-several={several && !fielded ? "" : undefined}
        >
          {/* what belongs to the current note or group, or to the selection: outside the zoomed world, so it keeps
            its size */}
          <div className="app-surface__note-tools" data-surface-writing>
            {paused ? null : fielded ? (
              <>
                <button
                  className="sb-text-action"
                  type="button"
                  onPointerDown={keepFocus}
                  onClick={() => endField(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  className="sb-secondary-action"
                  type="button"
                  onPointerDown={keepFocus}
                  onClick={() => endField(true)}
                >
                  {t("note.save")}
                </button>
              </>
            ) : several ? (
              <>
                <p className="app-surface__count sb-num">{t("surface.selected", { count: selected.length })}</p>
                {moveTool}
                <button
                  className="sb-text-action app-tool"
                  type="button"
                  onClick={() => {
                    clearPicked();
                    ground.current?.focus({ preventScroll: true });
                  }}
                >
                  <Icon name="close" />
                  <span className="app-tool__word">{t("surface.clear")}</span>
                </button>
              </>
            ) : currentNote ? (
              <>
                {mayEditNote(currentNote) && (
                  <button className="sb-text-action app-tool" type="button" onClick={() => edit(currentNote)}>
                    <Icon name="edit" />
                    <span className="app-tool__word">{t("note.edit")}</span>
                  </button>
                )}
                {mayDeleteNote(currentNote, you) && (
                  <button className="sb-text-action app-tool" type="button" onClick={() => askDelete(currentNote)}>
                    <Icon name="trash" />
                    <span className="app-tool__word">{t("note.delete")}</span>
                  </button>
                )}
                {moveTool}
              </>
            ) : (
              currentGroup && (
                <>
                  <button className="sb-text-action app-tool" type="button" onClick={() => rename(currentGroup)}>
                    <Icon name="edit" />
                    <span className="app-tool__word">{t("group.rename")}</span>
                  </button>
                  <button
                    className="sb-text-action app-tool"
                    type="button"
                    onClick={() => askDeleteGroup(currentGroup)}
                  >
                    <Icon name="trash" />
                    <span className="app-tool__word">{t("group.delete")}</span>
                  </button>
                </>
              )
            )}
          </div>
          <div className="app-surface__view-tools">
            {/* a finger has no Shift: while this is on, a press on a note picks it */}
            {!paused && (
              <button
                className="sb-text-action app-tool"
                type="button"
                aria-pressed={choosing}
                onClick={() => {
                  setChoosing(!choosing);
                  say(t(choosing ? "surface.chooseOff" : "surface.choosing"));
                }}
              >
                <Icon name="check" />
                <span className="app-tool__word">{t("surface.choose")}</span>
              </button>
            )}
            <button
              className="sb-icon-button app-surface__keys-key"
              type="button"
              aria-label={t("surface.keysName")}
              aria-expanded={legend}
              aria-controls="app-surface-keys"
              onClick={() => setLegend(!legend)}
            >
              <Icon name="keyboard" />
            </button>
            <button
              className="sb-icon-button"
              type="button"
              aria-label={t("surface.zoomOut")}
              onClick={() => {
                measure();
                zoomBy(1 / ZOOM_STEP);
              }}
            >
              <Icon name="zoom-out" />
            </button>
            <button
              className="sb-icon-button"
              type="button"
              aria-label={t("surface.zoomIn")}
              onClick={() => {
                measure();
                zoomBy(ZOOM_STEP);
              }}
            >
              <Icon name="zoom-in" />
            </button>
            <button
              className="sb-text-action app-tool"
              type="button"
              onClick={() => {
                measure();
                fitAll();
              }}
            >
              <Icon name="zoom-fit" />
              <span className="app-tool__word">{t("surface.fit")}</span>
            </button>
          </div>
        </div>
        {/* a change that was not taken: why, next to where it was made. The region is there before its sentence */}
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
        <div
          ref={frame}
          className="app-surface__frame"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onDoubleClick={onDoubleClick}
        >
          <div
            ref={ground}
            className="app-surface__ground"
            role="listbox"
            tabIndex={0}
            aria-label={t("surface.notes")}
            aria-multiselectable="true"
            aria-describedby="app-surface-keys"
            aria-activedescendant={
              fielded
                ? undefined
                : currentNote
                  ? noteId(currentNote.id)
                  : currentGroup
                    ? frameId(currentGroup.id)
                    : undefined
            }
            onKeyDown={onKeyDown}
            // the focus leaves the surface while something is being moved: it is dropped where it lies
            onBlur={() => drop()}
          >
            <div
              ref={world}
              className="app-surface__world"
              role="presentation"
              data-gliding={glide.on ? "" : undefined}
              style={glide.on ? { ["--app-glide" as string]: `${GLIDE_MS}ms` } : undefined}
            >
              {/* the frames first: a note always lies above the frame it lies in */}
              {groups.map((group) => {
                const carriedNow = lifted !== null && lifted.what === "group" && lifted.id === group.id ? lifted : null;
                const title = titleOf(t, group);
                return (
                  <GroupFrame
                    key={group.id}
                    id={group.id}
                    box={carriedNow ? carriedBox(group, carriedNow) : group}
                    title={title}
                    untitled={group.title === ""}
                    label={t("group.option", {
                      title,
                      notes: t("wall.noteCount", { count: members.get(group.id) ?? 0 }),
                    })}
                    lifted={carriedNow !== null}
                    naming={naming !== null && naming.id === group.id}
                  />
                );
              })}
              {notes.map((note, n) => {
                // what the keys carry lies where they have put it: the notes themselves, or the notes of the group
                const by =
                  lifted === null
                    ? null
                    : lifted.what === "notes"
                      ? lifted.ids.has(note.id)
                        ? lifted.by
                        : null
                      : note.groupId === lifted.id
                        ? lifted.by
                        : null;
                const group = note.groupId === null ? undefined : groupById.get(note.groupId);
                return (
                  <NoteCard
                    key={note.id}
                    note={note}
                    x={note.x + (by?.x ?? 0)}
                    y={note.y + (by?.y ?? 0)}
                    own={note.mine ? t("note.own") : undefined}
                    where={group && t("note.inGroup", { group: titleOf(t, group) })}
                    selected={pickedNotes.length > 0 ? picked.has(note.id) : note.id === currentNote?.id}
                    picked={picked.has(note.id)}
                    lifted={by !== null}
                    writing={writing !== null && writing.id === note.id}
                    // the notes set out one after the other, the last one GLIDE_STAGGER_MS after the first
                    delay={glide.on ? Math.round((n / Math.max(1, notes.length - 1)) * GLIDE_STAGGER_MS) : undefined}
                  />
                );
              })}
            </div>
          </div>
          {/* the layer above the world, moved with it: the field a note or a group's title is written in */}
          <div ref={over} className="app-surface__world app-surface__world--over">
            {writing !== null && (
              <NoteField
                key={writing.id ?? "new"}
                writing={writing}
                onText={(text) => (draft.current = text)}
                onDone={endWriting}
                room={() => {
                  // the surface's height at this zoom, less the room around the field, the note's own edge and the
                  // line that counts; never less than a note's three lines
                  const { unit, size } = metric.current;
                  const units = (size.h - 2 * MARGIN) / view.current.zoom - 2 * NOTE_PADDING - LENGTH_LINE;
                  return Math.max(NOTE_MIN_LINES * NOTE_LINE_HEIGHT, units) * unit;
                }}
                onGrow={() => {
                  const el = document.getElementById(NOTE_FIELD);
                  if (!el) return;
                  const { unit } = metric.current;
                  follow({ x: writing.x, y: writing.y, w: el.offsetWidth / unit, h: el.offsetHeight / unit });
                }}
              />
            )}
            {naming !== null && (
              <TitleField
                key={naming.id ?? "new"}
                naming={naming}
                onTitle={(title) => (draft.current = title)}
                onDone={endNaming}
              />
            )}
          </div>
          <div ref={mark} className="app-surface__mark" data-lifted={lifted !== null ? "" : undefined} hidden>
            {/* the handle that changes the current group's size: on the surface, so it keeps its size at every zoom.
              For a pointer alone: with the keys, M and then Shift with the arrow keys do the same */}
            {currentGroup && !fielded && lifted === null && !paused && (
              <div className="app-surface__handle" data-surface-handle aria-hidden="true">
                <Icon name="grip" />
              </div>
            )}
          </div>
          {notes.length === 0 && groups.length === 0 && !fielded && (
            <p className="app-surface__empty">{t(hidden === null ? "surface.empty" : "surface.emptyHidden")}</p>
          )}
        </div>
        {/* the keys of the surface, said once: its description, and a line under it for whoever asks with „Tasten“.
          While something is being moved, the line says how that goes on */}
        <p className="app-surface__keys" id="app-surface-keys" data-shown={legend ? "" : undefined}>
          {movingKeys}
        </p>
      </section>
      {/* what the surface asks: beside it, not in it. The surface cuts what lies outside its edge, and a dialog
          stands in the middle of the window */}
      <DeleteNoteAsk
        text={asking?.about === "note" ? asking.text : null}
        onClose={(confirmed) => {
          const asked = asking;
          setAsking(null);
          if (!confirmed || asked?.about !== "note") return;
          send({ type: "note.delete", opId: generateHexId(), noteId: asked.id });
          setCurrent(null);
          // the tool that asked is gone with the note: the surface takes the focus
          ground.current?.focus({ preventScroll: true });
        }}
      />
      <DeleteGroupAsk
        group={askedGroup ? { title: titleOf(t, askedGroup), notes: members.get(askedGroup.id) ?? 0 } : null}
        onClose={(confirmed) => {
          const asked = asking;
          setAsking(null);
          if (!confirmed || asked?.about !== "group") return;
          const left = members.get(asked.id) ?? 0;
          send({ type: "group.delete", opId: generateHexId(), groupId: asked.id });
          setCurrent(null);
          say(left > 0 ? t("group.deletedNotes", { count: left }) : t("group.deleted"));
          ground.current?.focus({ preventScroll: true });
        }}
      />
      <MoveAsk
        asking={asking?.about === "move" ? { notes: asking.ids.length, from } : null}
        groups={groups}
        onClose={(to) => {
          const asked = asking;
          setAsking(null);
          if (to !== undefined && asked?.about === "move") moveInto(asked.ids, to);
        }}
      />
    </>
  );
});
