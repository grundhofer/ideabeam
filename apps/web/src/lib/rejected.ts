// rejected.ts: why a change was not taken, as a sentence: its key in the string tables (`reject.*`). One for every
// reason a change to a wall's notes and groups, or a step of the moderation (revealing, the clock, arranging), can
// meet: the wall's own reject codes (protocol.ts), the rate limit, a change that waited for a connection behind too
// many others, and every way „Ordnen“ ends without a proposal (lib/api.ts, store/arrange.ts), at the app's own
// service and at the moderation's provider.
import { providerOf } from "@ideabeam/arrange";
import type { Rejected } from "../store/wall";

export type RejectKey =
  | "notAuthorEdit"
  | "notAuthorDelete"
  | "notFound"
  | "notFoundGroup"
  | "limit"
  | "limitGroups"
  | "conflict"
  | "invalid"
  | "phaseGroups"
  | "phaseClock"
  | "phaseArrange"
  | "staleClock"
  | "staleStep"
  | "staleUndo"
  | "phaseBallot"
  | "staleBallot"
  | "daySpent"
  | "notAdmin"
  | "rateLimit"
  | "lost"
  | "applyChanged"
  | "arrangeNothing"
  | "arrangeBudget"
  | "arrangeBudgetNoTime"
  | "arrangeRuns"
  | "arrangeFailed"
  | "arrangeUnavailable"
  | "arrangeNetwork"
  | "arrangeTimeout"
  | "arrangeUnknown"
  | "arrangeNothingLeft"
  | "keyRefused"
  | "keyRefusedBrowser"
  | "keyNoCredit"
  | "keyRateLimited"
  | "keyRejected"
  | "keyDeclined"
  | "keyUnreachable"
  | "keyUnusable"
  | "keyTimeout"
  | "keyLoad";

export function rejectKey(rejected: Rejected): RejectKey {
  // „Ordnen“ gave no proposal: the Worker's reasons, and the app's own
  if (rejected.command === "arrange") return arrangeKey(rejected.code, rejected.resetsAt !== undefined);
  // the same with the moderation's own key: what its provider said, and the app's own reasons
  if (rejected.command === "arrange.key") return ownKeyKey(rejected);
  const { code, command } = rejected;
  // an arrangement the wall did not take, or did not take back
  const applying = command === "admin.arrange.apply";
  const undoing = command === "admin.arrange.undo";
  switch (code) {
    case "NOT_AUTHOR":
      // deleting is the author's or the moderation's, the text the author's alone
      return command === "note.delete" ? "notAuthorDelete" : "notAuthorEdit";
    case "NOT_FOUND":
      // An arrangement named a note that is gone: the browser lays the proposal out again and sends it once more
      // (store/arrange.ts); this is the second refusal. A group that is gone: only a change to the group itself
      // meets this (a note dropped into it simply has none).
      if (applying) return "applyChanged";
      return command === "group.update" ? "notFoundGroup" : "notFound";
    case "LIMIT":
      // an arrangement makes groups, never notes: the limit it can meet is the groups'
      return command === "group.create" || applying ? "limitGroups" : "limit";
    case "CONFLICT":
      // an arrangement touched what is a person's by then (a note in a group made by hand or renamed): refused
      // twice, as above
      return applying ? "applyChanged" : "conflict";
    case "INVALID":
      return "invalid";
    case "PHASE":
      // The step does not take it: a group or an arrangement while the notes are hidden (the wall offers neither
      // then), or a control of the clock that crossed somebody else's step move.
      if (command?.startsWith("group.")) return "phaseGroups";
      // a ballot after the moderation counted, or counting that crossed a step move
      if (command === "ballot.cast" || command === "admin.step.count") return "phaseBallot";
      if (applying || undoing) return "phaseArrange";
      return command?.startsWith("admin.clock.") ? "phaseClock" : "invalid";
    case "STALE":
      // An arrangement that is no longer the wall's last one cannot be taken back. A step move made for a step the
      // wall has left meanwhile (another tab of the moderation moved first). Else: a control of the clock that was
      // made for a clock another control has changed meanwhile.
      if (undoing) return "staleUndo";
      // a ballot made in a step the wall has left meanwhile
      if (command === "ballot.cast") return "staleBallot";
      if (command === "admin.step.count") return "staleStep";
      return command === "admin.step.go" ? "staleStep" : "staleClock";
    case "DAY_SPENT":
      // the wall's brake: its day's changes are written; the sentence names the time it goes on (`resetsAt`)
      return "daySpent";
    case "NOT_ADMIN":
      return "notAdmin";
    case "RATE_LIMIT":
      return "rateLimit";
    case "LOST":
      return "lost";
  }
}

/** The sentence of „Ordnen“ that gave no proposal. Each names what now: when it goes on, to try again, or to
 *  arrange by hand, which always works. An answer the app does not know (a wall the Worker does not find, a request
 *  it calls malformed or too large, anything else) shares one sentence that is true of all of them. `timed`: the
 *  answer says when it goes on (`resetsAt`). */
function arrangeKey(code: Extract<Rejected, { command: "arrange" }>["code"], timed: boolean): RejectKey {
  switch (code) {
    case "NOTHING_TO_ARRANGE":
      return "arrangeNothing";
    case "AI_BUDGET_SPENT":
      // The product's own budget of 24 hours says when the run fits again. Without a time it was Cloudflare that
      // refused, whose allowance all products of the account share: the app does not know when that frees up, and
      // says so
      return timed ? "arrangeBudget" : "arrangeBudgetNoTime";
    case "WALL_RUNS_SPENT":
      return "arrangeRuns";
    case "AI_FAILED":
      return "arrangeFailed";
    case "AI_UNAVAILABLE":
      return "arrangeUnavailable";
    case "PHASE":
      return "phaseArrange";
    case "NOT_ADMIN":
      return "notAdmin";
    case "NETWORK":
      return "arrangeNetwork";
    case "TIMEOUT":
      return "arrangeTimeout";
    case "NOTHING_LEFT":
      return "arrangeNothingLeft";
    case "WALL_NOT_FOUND":
    case "INVALID_REQUEST":
    case "UNKNOWN":
      return "arrangeUnknown";
  }
}

/** The sentence of „Ordnen“ with the moderation's own key that gave no proposal. Each names the provider and what
 *  now, and nothing of what the provider wrote: its words may quote the key or a note. A key that is refused has
 *  two sentences: Anthropic also refuses a valid key of an account that keeps no data there, when it comes from a
 *  browser, and the sentence for Anthropic says so. */
function ownKeyKey({ code, provider }: Extract<Rejected, { command: "arrange.key" }>): RejectKey {
  switch (code) {
    case "KEY_REFUSED":
      return providerOf(provider).facts.refusesBrowserWithoutRetention ? "keyRefusedBrowser" : "keyRefused";
    case "NO_CREDIT":
      return "keyNoCredit";
    case "RATE_LIMITED":
      return "keyRateLimited";
    case "REJECTED":
      return "keyRejected";
    case "DECLINED":
      return "keyDeclined";
    case "UNREACHABLE":
      return "keyUnreachable";
    case "UNUSABLE":
      return "keyUnusable";
    case "TIMEOUT":
      return "keyTimeout";
    case "LOAD":
      return "keyLoad";
  }
}
