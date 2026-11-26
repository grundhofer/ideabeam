// ClockControls.tsx: the moderation's controls of the writing's clock (the owner's decision 13, PLAN.md 7.2): choose
// a time and start, pause and resume, five minutes more, and no clock any more. Few and calm: they stand at the
// wall's top, in the bar beside its state (on a phone under it), for the moderation alone and only while the notes
// are hidden. What is left of the time everybody reads in the state, as a sentence (lib/clock.ts). Nothing changes
// here before the wall has said so: a control shows when its frame arrives, for everyone at once.
//
// The time is chosen from a list, never typed, so there is nothing to get wrong: the usual ones first, then every
// other minute a clock can be set to.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CLOCK_EXTEND_MINUTES, CLOCK_MAX_MINUTES, CLOCK_MIN_MINUTES } from "@ideabeam/shared";
import type { ClockLine } from "../lib/clock";
import { Field } from "../sebaro/react/Field";
import { Icon } from "../sebaro/react/Icon";
import type { ClockControl } from "../store/wall";

/** The times a writing usually gets, in minutes; the first stretch of a brainstorming is short. */
const USUAL = [3, 5, 10, 15, 20, 30];
const FIRST = 5;
/** Every other time a clock can be set to. */
const OTHER = Array.from({ length: CLOCK_MAX_MINUTES - CLOCK_MIN_MINUTES + 1 }, (_, n) => CLOCK_MIN_MINUTES + n).filter(
  (minutes) => !USUAL.includes(minutes),
);

type Props = {
  /** what the clock is doing, as the wall says it: null without a clock */
  line: ClockLine;
  /** five minutes more still fit: a clock never holds more than the longest time it can be set to */
  canExtend: boolean;
  onControl(control: ClockControl): void;
};

export function ClockControls({ line, canExtend, onControl }: Props) {
  const { t } = useTranslation();
  // the time the next clock starts with: this browser's choice until „Uhr starten“ sends it
  const [minutes, setMinutes] = useState(FIRST);
  const option = (value: number) => (
    <option key={value} value={value}>
      {t("wall.clock.minutes", { count: value })}
    </option>
  );
  const more = t("wall.clock.extend", { count: CLOCK_EXTEND_MINUTES });

  // an area of its own for the check of a view: its one outlined action stands beside the copy key of the state
  return (
    <div className="app-clock" role="group" aria-label={t("wall.clock.controls")} data-sb-action-area="clock">
      {line === null ? (
        <>
          <Field id="app-f-clock" label={t("wall.clock.length")} frame="sb-select">
            {(control) => (
              <>
                <select {...control} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}>
                  <optgroup label={t("wall.clock.usual")}>{USUAL.map(option)}</optgroup>
                  <optgroup label={t("wall.clock.other")}>{OTHER.map(option)}</optgroup>
                </select>
                <Icon name="chevron-down" />
              </>
            )}
          </Field>
          <button className="sb-secondary-action" type="button" onClick={() => onControl({ type: "start", minutes })}>
            <Icon name="timer" />
            {t("wall.clock.start")}
          </button>
        </>
      ) : (
        <>
          {line.is === "left" && (
            <button className="sb-secondary-action" type="button" onClick={() => onControl({ type: "pause" })}>
              <Icon name="pause" />
              {t("wall.clock.pause")}
            </button>
          )}
          {line.is === "paused" && (
            <button className="sb-secondary-action" type="button" onClick={() => onControl({ type: "resume" })}>
              <Icon name="play" />
              {t("wall.clock.resume")}
            </button>
          )}
          {/* once the time is up, more time is the one step left beside revealing: the area's outlined action */}
          {canExtend && (
            <button
              className={line.is === "over" ? "sb-secondary-action" : "sb-text-action"}
              type="button"
              onClick={() => onControl({ type: "extend" })}
            >
              {more}
            </button>
          )}
          <button className="sb-text-action" type="button" onClick={() => onControl({ type: "clear" })}>
            {t("wall.clock.clear")}
          </button>
        </>
      )}
    </div>
  );
}
