// paced.ts: a value that changes in bursts, shown at a pace. On a wall, notes arrive one by one from several people;
// the sentence that says how many there are is a live region, and a screen reader would be told every single one.
// Paced, a change shows at once, and what follows in the next moment shows together, once the moment is over: a
// burst is said in a sentence or two, never one per note (PLAN.md 3.7).
import { useEffect, useRef, useState } from "react";

/** How long what shows stands before the next change shows. */
export const PACE_MS = 1500;

/** `value`, but no more often than once per `pace` ms: a change after a quiet time shows at once; further changes
 *  wait until the time is over, and then the latest one shows. Values are compared as they are (`Object.is`): pass a
 *  number or a string. */
export function usePaced<T>(value: T, pace = PACE_MS): T {
  const [shown, setShown] = useState(value);
  // when what shows last changed
  const last = useRef(0);
  useEffect(() => {
    if (Object.is(value, shown)) return;
    const timer = setTimeout(
      () => {
        last.current = Date.now();
        setShown(value);
      },
      Math.max(0, last.current + pace - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [value, shown, pace]);
  return shown;
}
