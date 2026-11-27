// Rank.tsx: a step that ranks (stage M5, „Stille Ideenrunde mit Rangfolge“: „Die fünf wichtigsten ranken“), in the
// place of the surface. The rank vote has stood in the rules and the Worker since stage M2 (domain/vote.ts, Borda over
// the first N); this is its panel. Two lists: „Deine Rangfolge“, the options chosen so far in their order, each with
// „Nach oben“, „Nach unten“ and „Entfernen“; and „Zur Auswahl“, the rest, each with „Wählen“, which puts it last in the
// ranking while places are free. Everything is a button: no dragging, and the keyboard alone does all of it. After a
// key moved a row, the focus goes with the row, to the same key in its new place, so a row is moved by pressing the
// same key again. Nothing leaves the browser before „Abgeben“ (pages/Wall.tsx): the draft is the view's.
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Group, Note, VoteRound } from "@ideabeam/shared";
import { Icon } from "../sebaro/react/Icon";
import { titleOf } from "./Asks";

/** Where the focus goes after a key changed the lists: a key of a row, by the row's option and the key's kind. */
type Focus = { id: string; key: "up" | "down" | "remove" | "choose" } | null;

export function RankPanel(props: {
  round: VoteRound;
  /** the options chosen, in their order: the draft, or what the wall stored */
  order: readonly string[];
  notes: readonly Note[];
  groups: readonly Group[];
  problem: string | null;
  onDismiss(): void;
  onChange(order: string[]): void;
}) {
  const { round, order, notes, groups, problem, onDismiss, onChange } = props;
  const { t } = useTranslation();
  const keys = useRef(new Map<string, HTMLButtonElement>());
  const focus = useRef<Focus>(null);
  const setFocus = (next: Focus) => {
    focus.current = next;
  };
  // the focus follows the row a key moved, once the lists show where it went
  useLayoutEffect(() => {
    const next = focus.current;
    if (next === null) return;
    focus.current = null;
    keys.current.get(`${next.key}:${next.id}`)?.focus();
  });
  const ref = (key: string) => (element: HTMLButtonElement | null) => {
    if (element === null) keys.current.delete(key);
    else keys.current.set(key, element);
  };
  const known = new Set(round.options.map((option) => option.id));
  const chosen = order.filter((id) => known.has(id));
  const rest = round.options.filter((option) => !chosen.includes(option.id));
  const left = Math.max(0, round.limit - chosen.length);
  const nameOf = (id: string) => {
    const option = round.options.find((one) => one.id === id);
    if (option?.kind === "group") {
      const group = groups.find((one) => one.id === id);
      return group === undefined ? t("group.untitled") : titleOf(t, group);
    }
    return notes.find((note) => note.id === id)?.text ?? "";
  };
  const metaOf = (id: string) => {
    const option = round.options.find((one) => one.id === id);
    if (option?.kind !== "group") return null;
    const inside = notes.filter((note) => note.groupId === id).map((note) => note.text);
    return inside.length === 0 ? null : inside.join(" · ");
  };
  const move = (from: number, to: number) => {
    const next = [...chosen];
    const [id] = next.splice(from, 1);
    if (id === undefined) return;
    next.splice(to, 0, id);
    onChange(next);
  };
  return (
    <section className="app-ballot app-rank" aria-labelledby="app-h-rank">
      <h2 className="sb-list-header" id="app-h-rank">
        {t("rank.heading", { count: round.limit })}
      </h2>
      {/* how many places are free, said when it changes; the problem of a ballot that was not taken under it */}
      <p className="app-ballot__left sb-num" role="status">
        {left === 0 ? t("rank.none") : t("rank.left", { count: left })}
      </p>
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
      {round.omitted > 0 && <p className="app-ballot__note">{t("vote.omitted", { count: round.omitted })}</p>}
      <h3 className="app-rank__heading" id="app-h-rank-chosen">
        {t("rank.chosen")}
      </h3>
      {chosen.length === 0 ? (
        <p className="app-ballot__note">{t("rank.empty")}</p>
      ) : (
        <ol className="sb-list app-ballot__list" aria-labelledby="app-h-rank-chosen">
          {chosen.map((id, at) => {
            const name = nameOf(id);
            const meta = metaOf(id);
            const labelId = `app-rank-${id}`;
            const first = at === 0;
            const last = at === chosen.length - 1;
            return (
              <li key={id} className="sb-list-row app-ballot__row">
                <span className="sb-list-row__lead app-results__place sb-num">{at + 1}.</span>
                <div className="sb-list-row__main">
                  <p className="sb-list-row__title" id={labelId}>
                    {name}
                  </p>
                  {meta !== null && <p className="sb-list-row__meta">{meta}</p>}
                </div>
                <div className="sb-list-row__trail app-ballot__stepper" role="group" aria-labelledby={labelId}>
                  {/* a key that cannot act stays where it is and in the tab order: aria-disabled, not disabled */}
                  <button
                    ref={ref(`up:${id}`)}
                    className="sb-icon-button"
                    type="button"
                    aria-label={t("rank.up", { name, place: at + 1 })}
                    aria-disabled={first || undefined}
                    onClick={() => {
                      if (first) return;
                      move(at, at - 1);
                      setFocus({ id, key: "up" });
                    }}
                  >
                    <Icon name="arrow-up" />
                  </button>
                  <button
                    ref={ref(`down:${id}`)}
                    className="sb-icon-button"
                    type="button"
                    aria-label={t("rank.down", { name, place: at + 1 })}
                    aria-disabled={last || undefined}
                    onClick={() => {
                      if (last) return;
                      move(at, at + 1);
                      setFocus({ id, key: "down" });
                    }}
                  >
                    <Icon name="arrow-down" />
                  </button>
                  <button
                    ref={ref(`remove:${id}`)}
                    className="sb-icon-button"
                    type="button"
                    aria-label={t("rank.remove", { name })}
                    onClick={() => {
                      onChange(chosen.filter((other) => other !== id));
                      // back where it can be chosen again
                      setFocus({ id, key: "choose" });
                    }}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <h3 className="app-rank__heading" id="app-h-rank-rest">
        {t("rank.rest")}
      </h3>
      {round.options.length === 0 ? (
        <p className="sb-list-end">{t("vote.noOptions")}</p>
      ) : rest.length === 0 ? (
        <p className="app-ballot__note">{t("rank.allChosen")}</p>
      ) : (
        <ul className="sb-list app-ballot__list" aria-labelledby="app-h-rank-rest">
          {rest.map((option, at) => {
            const name = nameOf(option.id);
            const meta = metaOf(option.id);
            const full = left === 0;
            return (
              <li key={option.id} className="sb-list-row app-ballot__row">
                <div className="sb-list-row__main">
                  <p className="sb-list-row__title">{name}</p>
                  {meta !== null && <p className="sb-list-row__meta">{meta}</p>}
                </div>
                <div className="sb-list-row__trail">
                  <button
                    ref={ref(`choose:${option.id}`)}
                    className="sb-text-action"
                    type="button"
                    aria-label={t("rank.choose", { name })}
                    aria-disabled={full || undefined}
                    onClick={() => {
                      if (full) return;
                      onChange([...chosen, option.id]);
                      // the next row of the rest, or the row just chosen where none is left
                      const next = rest[at + 1] ?? rest[at - 1];
                      setFocus(
                        next !== undefined && chosen.length + 1 < round.limit
                          ? { id: next.id, key: "choose" }
                          : { id: option.id, key: "remove" },
                      );
                    }}
                  >
                    <Icon name="plus" />
                    {t("rank.chooseWord")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
