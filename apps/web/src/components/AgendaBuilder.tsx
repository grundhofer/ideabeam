// AgendaBuilder.tsx: the agenda of a wall, several methods one after the other (stage M7, PLAN-METHODEN.md 5): on
// `/neu` under the question, and on the wall in „Mehr“ → „Ablauf“ for the methods not reached yet. The choice of the
// method (components/MethodChoice.tsx) chooses the method of one item, the one being chosen; „Weitere Methode
// anhängen“ adds an item and moves the focus into the choice, whose arrow keys then choose its method. With more than
// one item the agenda stands above the choice as a numbered list: each item with its method's name and, always, its
// short description (PLAN-METHODEN.md 2), its own prompt (optional: the wall's question where it is left empty), the
// unit of a method that estimates, and its keys: „Methode wählen“, „Nach oben“, „Nach unten“, „Entfernen“. No
// dragging: every key is a button, and after a key moved an item the focus goes with it, to the same key in its new
// place (as components/Rank.tsx does). Items the wall has begun (`fixed`, on the wall) stand first, without keys and
// fields: a step that was reached never changes.
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  CATALOGUE,
  DEFAULT_METHOD,
  MAX_AGENDA_ITEMS,
  methodTexts,
  PROMPT_MAX,
  UNIT_MAX,
  type MethodId,
  type MethodLanguage,
} from "@ideabeam/shared";
import { Field } from "../sebaro/react/Field";
import { Icon } from "../sebaro/react/Icon";
import { MethodChoice } from "./MethodChoice";

/** An item of the agenda as it is edited: `key` tells the items apart while they move. */
export type AgendaItem = { key: string; methodId: MethodId; prompt: string; unit: string };

let minted = 0;
/** A new item, with the method a wall starts with unless another is chosen. */
export function newItem(methodId: MethodId = DEFAULT_METHOD, prompt = "", unit = ""): AgendaItem {
  minted += 1;
  return { key: `item-${minted}`, methodId, prompt, unit };
}

/** Whether a method asks for the unit of its estimates (stage M3). */
export function estimates(methodId: MethodId): boolean {
  return CATALOGUE[methodId].steps.some((step) => step.vote?.kind === "estimate");
}

type Focus = { key: string; part: "up" | "down" | "choose" } | { key: null; part: "add" } | null;

type Props = {
  lang: MethodLanguage;
  /** the ids of this builder's fields begin with it: `/neu` and the wall's dialog each have one */
  id: string;
  items: AgendaItem[];
  /** how many items at the start the wall has begun: shown, never changed (the wall's dialog; 0 on `/neu`) */
  fixed?: number;
  /** the item whose method the choice chooses */
  active: number;
  onChange(items: AgendaItem[], active: number): void;
  /** what is wrong with an item's prompt or unit, by its key, said at its field */
  faults?: Record<string, { prompt?: string; unit?: string }>;
  /** the list even with one item (the wall's dialog, where the items reached stand in it) */
  listed?: boolean;
  /** what stands right under the choice: on `/neu`, with one method, the unit of a method that estimates */
  afterChoice?: ReactNode;
  /** Enter in a field does not send the form around it: in the wall's dialog it would close it */
  holdEnter?: boolean;
};

export function AgendaBuilder(props: Props) {
  const { lang, id, items, fixed = 0, active, onChange, faults = {}, listed = false, afterChoice, holdEnter } = props;
  const onKeyDown = holdEnter
    ? (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") event.preventDefault();
      }
    : undefined;
  const { t } = useTranslation();
  const keys = useRef(new Map<string, HTMLButtonElement>());
  const focus = useRef<Focus>(null);
  const [said, setSaid] = useState("");
  // the focus follows what a key moved, once the list shows where it went; after „Anhängen“ it goes into the choice
  useLayoutEffect(() => {
    const next = focus.current;
    if (next === null) return;
    focus.current = null;
    if (next.part === "add") {
      document.querySelector<HTMLInputElement>(`#${id}-choice input[type="radio"]:checked`)?.focus();
      return;
    }
    keys.current.get(`${next.part}:${next.key}`)?.focus();
  });
  const ref = (key: string) => (element: HTMLButtonElement | null) => {
    if (element === null) keys.current.delete(key);
    else keys.current.set(key, element);
  };
  const full = items.length >= MAX_AGENDA_ITEMS;
  const showList = listed || items.length > 1;
  const current = items[active];
  const nameOf = (item: AgendaItem) => methodTexts(lang, item.methodId).name;

  const change = (next: AgendaItem[], nextActive: number) => onChange(next, nextActive);
  const move = (from: number, to: number, part: "up" | "down") => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    if (item === undefined) return;
    next.splice(to, 0, item);
    const keyOfActive = items[active]?.key;
    focus.current = { key: item.key, part };
    change(
      next,
      next.findIndex((one) => one.key === keyOfActive),
    );
    setSaid(t("agenda.saidMoved", { name: nameOf(item), n: to + 1, of: next.length }));
  };
  const remove = (at: number) => {
    const item = items[at];
    if (item === undefined) return;
    const next = items.filter((_, index) => index !== at);
    const stay = Math.min(Math.max(fixed, at), next.length - 1);
    const nextActive = at === active ? stay : active > at ? active - 1 : active;
    const target = next[stay];
    focus.current =
      target === undefined || stay < fixed ? { key: null, part: "add" } : { key: target.key, part: "choose" };
    change(next, Math.max(fixed, nextActive));
    setSaid(t("agenda.saidRemoved", { name: nameOf(item) }));
  };
  const append = () => {
    if (full) return;
    const item = newItem();
    focus.current = { key: null, part: "add" };
    change([...items, item], items.length);
    setSaid(t("agenda.saidAdded", { n: items.length + 1 }));
  };
  const edit = (at: number, patch: Partial<AgendaItem>) =>
    change(
      items.map((item, index) => (index === at ? { ...item, ...patch } : item)),
      active,
    );

  return (
    <div className="app-agenda" id={id}>
      {showList && (
        <section className="app-agenda__list" aria-labelledby={`${id}-heading`}>
          <h2 className="sb-list-header" id={`${id}-heading`}>
            {t("agenda.heading")} <span className="sb-list-header__count">{items.length}</span>
          </h2>
          <ol className="sb-list">
            {items.map((item, at) => {
              const texts = methodTexts(lang, item.methodId);
              const labelId = `${id}-item-${item.key}`;
              const shortId = `${id}-short-${item.key}`;
              const locked = at < fixed;
              const first = at === fixed;
              const last = at === items.length - 1;
              const chosen = at === active && !locked;
              const fault = faults[item.key] ?? {};
              return (
                <li key={item.key} className="app-agenda__item" data-item={at} aria-current={chosen || undefined}>
                  <p className="app-agenda__name" id={labelId}>
                    <span className="sb-num">{at + 1}.</span> {texts.name}
                  </p>
                  <p className="app-agenda__short" id={shortId}>
                    {texts.short}
                  </p>
                  {locked ? (
                    <p className="app-agenda__state app-muted">
                      {item.prompt === "" ? t("agenda.begun") : t("agenda.begunPrompt", { prompt: item.prompt })}
                    </p>
                  ) : (
                    <>
                      {chosen && <p className="app-agenda__state app-muted">{t("agenda.choosing")}</p>}
                      <div className="app-agenda__fields">
                        <Field
                          id={`${id}-prompt-${item.key}`}
                          label={t("agenda.prompt", { n: at + 1 })}
                          optional={t("common.optional")}
                          help={t("agenda.promptHelp")}
                          error={fault.prompt}
                        >
                          {(control) => (
                            <input
                              {...control}
                              type="text"
                              autoComplete="off"
                              value={item.prompt}
                              onKeyDown={onKeyDown}
                              onChange={(event) => edit(at, { prompt: event.target.value })}
                            />
                          )}
                        </Field>
                        {estimates(item.methodId) && (
                          <Field
                            id={`${id}-unit-${item.key}`}
                            label={t("agenda.unit", { n: at + 1 })}
                            optional={t("common.optional")}
                            help={t("new.unitHelp")}
                            error={fault.unit}
                          >
                            {(control) => (
                              <input
                                {...control}
                                type="text"
                                autoComplete="off"
                                value={item.unit}
                                onKeyDown={onKeyDown}
                                onChange={(event) =>
                                  edit(at, { unit: event.target.value.replace(/[\p{Cc}\u2028\u2029]/gu, "") })
                                }
                              />
                            )}
                          </Field>
                        )}
                      </div>
                      <div className="app-agenda__keys" role="group" aria-labelledby={labelId}>
                        <button
                          ref={ref(`choose:${item.key}`)}
                          className="sb-text-action"
                          type="button"
                          aria-pressed={chosen}
                          aria-label={t("agenda.choose", { n: at + 1, name: texts.name })}
                          onClick={() => {
                            focus.current = { key: null, part: "add" };
                            change(items, at);
                          }}
                        >
                          {t("agenda.chooseWord")}
                        </button>
                        {/* a key that cannot act stays where it is and in the tab order: aria-disabled */}
                        <button
                          ref={ref(`up:${item.key}`)}
                          className="sb-icon-button"
                          type="button"
                          aria-label={t("agenda.up", { n: at + 1, name: texts.name })}
                          aria-disabled={first || undefined}
                          onClick={() => !first && move(at, at - 1, "up")}
                        >
                          <Icon name="arrow-up" />
                        </button>
                        <button
                          ref={ref(`down:${item.key}`)}
                          className="sb-icon-button"
                          type="button"
                          aria-label={t("agenda.down", { n: at + 1, name: texts.name })}
                          aria-disabled={last || undefined}
                          onClick={() => !last && move(at, at + 1, "down")}
                        >
                          <Icon name="arrow-down" />
                        </button>
                        <button
                          className="sb-icon-button"
                          type="button"
                          aria-label={t("agenda.remove", { n: at + 1, name: texts.name })}
                          aria-disabled={items.length - fixed <= (fixed === 0 ? 1 : 0) || undefined}
                          onClick={() => items.length - fixed > (fixed === 0 ? 1 : 0) && remove(at)}
                        >
                          <Icon name="close" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {current !== undefined && active >= fixed && (
        <div id={`${id}-choice`}>
          <MethodChoice
            lang={lang}
            value={current.methodId}
            legend={showList ? t("agenda.method", { n: active + 1, of: items.length }) : undefined}
            onChange={(methodId) => edit(active, { methodId })}
          />
        </div>
      )}
      {afterChoice}
      <div className="app-agenda__add">
        <button
          className="sb-text-action"
          type="button"
          aria-disabled={full || undefined}
          aria-describedby={`${id}-add-hint`}
          onClick={append}
        >
          <Icon name="plus" />
          {t("agenda.add")}
        </button>
        <p className="sb-field__help" id={`${id}-add-hint`}>
          <span>
            {full ? t("agenda.full", { max: MAX_AGENDA_ITEMS }) : t("agenda.addHint", { max: MAX_AGENDA_ITEMS })}
          </span>
        </p>
      </div>
      <p className="sb-visually-hidden" role="status">
        {said}
      </p>
    </div>
  );
}

/** What is wrong with the items' prompts and units, by item key, or null: nothing. */
export function agendaFaults(
  items: readonly AgendaItem[],
  words: { prompt: (max: number) => string; unit: (max: number) => string },
): Record<string, { prompt?: string; unit?: string }> | null {
  const found: Record<string, { prompt?: string; unit?: string }> = {};
  for (const item of items) {
    const prompt = item.prompt.trim().length > PROMPT_MAX ? words.prompt(PROMPT_MAX) : undefined;
    const unit = estimates(item.methodId) && item.unit.trim().length > UNIT_MAX ? words.unit(UNIT_MAX) : undefined;
    if (prompt !== undefined || unit !== undefined) {
      found[item.key] = { ...(prompt === undefined ? {} : { prompt }), ...(unit === undefined ? {} : { unit }) };
    }
  }
  return Object.keys(found).length === 0 ? null : found;
}
