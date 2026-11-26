import { expect, test } from "vitest";
import { MAX_GROUPS, MAX_NOTES, WALL_DAILY_RUNS } from "@ideabeam/shared";
import i18n from "../i18n";
import type { Rejected } from "../store/wall";
import { rejectKey } from "./rejected";

test("every way „Ordnen“ ends without a proposal has a sentence that says what now", () => {
  const key = (code: Extract<Rejected, { command: "arrange" }>["code"]) => rejectKey({ code, command: "arrange" });
  // too few notes: the sentence names how many it takes, and which notes count: those in no group that is a person's
  expect(key("NOTHING_TO_ARRANGE")).toBe("arrangeNothing");
  expect(i18n.t("reject.arrangeNothing", { min: 6 })).toBe(
    "Zum Ordnen sind es zu wenige Zettel: Die KI braucht mindestens 6, die in keiner von Hand angelegten oder umbenannten Gruppe liegen.",
  );
  expect(i18n.t("reject.arrangeNothing", { min: 6, lng: "en" })).toBe(
    "There are too few notes to group: the AI needs at least 6 that lie in no group made or renamed by hand.",
  );
  // The product's budget of the AI is spent, for every wall. It runs over 24 hours, so the sentence says no „heute“:
  // it names the time it goes on, with „morgen“ where that is the next day, and that by hand always works. It names
  // no way that this build does not have
  const timed = (code: "AI_BUDGET_SPENT" | "WALL_RUNS_SPENT") =>
    rejectKey({ code, command: "arrange", resetsAt: 1_795_392_000_000, at: 1_795_390_000_000 });
  expect(timed("AI_BUDGET_SPENT")).toBe("arrangeBudget");
  const [today, tomorrow] = [
    i18n.t("reject.whenToday", { time: "14:10" }),
    i18n.t("reject.whenTomorrow", { time: "13:50" }),
  ];
  expect([today, tomorrow]).toEqual(["Ab 14:10\u00a0Uhr", "Morgen ab 13:50\u00a0Uhr"]);
  expect(i18n.t("reject.arrangeBudget", { when: today })).toBe(
    "Das Kontingent der KI ist aufgebraucht, für alle Wände. Ab 14:10\u00a0Uhr geht es weiter. Von Hand ordnen geht immer.",
  );
  expect(i18n.t("reject.arrangeBudget", { when: tomorrow })).toBe(
    "Das Kontingent der KI ist aufgebraucht, für alle Wände. Morgen ab 13:50\u00a0Uhr geht es weiter. Von Hand ordnen geht immer.",
  );
  const [todayEn, tomorrowEn] = [
    i18n.t("reject.whenToday", { time: "14:10", lng: "en" }),
    i18n.t("reject.whenTomorrow", { time: "13:50", lng: "en" }),
  ];
  expect(i18n.t("reject.arrangeBudget", { when: todayEn, lng: "en" })).toBe(
    "The AI’s allowance is used up, for all walls. It goes on at 14:10. Grouping by hand always works.",
  );
  expect(i18n.t("reject.arrangeBudget", { when: tomorrowEn, lng: "en" })).toBe(
    "The AI’s allowance is used up, for all walls. It goes on tomorrow at 13:50. Grouping by hand always works.",
  );
  // Cloudflare itself refused: its allowance is the account's, and the answer names no time. The sentence is another
  // one, and says what is true: nobody here knows when it goes on, in 24 hours at the latest
  expect(key("AI_BUDGET_SPENT")).toBe("arrangeBudgetNoTime");
  expect(i18n.t("reject.arrangeBudgetNoTime")).toBe(
    "Das Kontingent der KI bei Cloudflare ist aufgebraucht, für alle Wände. Wann es weitergeht, kann die App nicht sagen: spätestens in 24\u00a0Stunden. Von Hand ordnen geht immer.",
  );
  expect(i18n.t("reject.arrangeBudgetNoTime", { lng: "en" })).toBe(
    "The AI’s allowance at Cloudflare is used up, for all walls. The app cannot say when it goes on: in 24\u00a0hours at the latest. Grouping by hand always works.",
  );
  // this wall has had its runs of the last 24 hours
  expect(timed("WALL_RUNS_SPENT")).toBe("arrangeRuns");
  expect(key("WALL_RUNS_SPENT")).toBe("arrangeRuns");
  expect(i18n.t("reject.arrangeRuns", { when: tomorrow, runs: WALL_DAILY_RUNS })).toBe(
    "Diese Wand hat die KI in 24\u00a0Stunden 6-mal ordnen lassen, öfter geht es nicht. Morgen ab 13:50\u00a0Uhr geht es wieder. Von Hand ordnen geht immer.",
  );
  expect(i18n.t("reject.arrangeRuns", { when: todayEn, runs: WALL_DAILY_RUNS, lng: "en" })).toBe(
    "The AI has been asked to group this wall 6 times in 24\u00a0hours, and more is not possible. It works again at 14:10. Grouping by hand always works.",
  );
  // the AI answered nothing usable, or there is none here
  expect(key("AI_FAILED")).toBe("arrangeFailed");
  expect(i18n.t("reject.arrangeFailed")).toBe(
    "Die KI hat keine brauchbare Antwort gegeben. Versuch es noch mal, oder ordnet von Hand.",
  );
  expect(key("AI_UNAVAILABLE")).toBe("arrangeUnavailable");
  expect(i18n.t("reject.arrangeUnavailable")).toBe("Auf diesem Server ist keine KI angeschlossen. Ordnet von Hand.");
  // the phase and the role: the sentences the wall's own rejects use
  expect(key("PHASE")).toBe("phaseArrange");
  expect(i18n.t("reject.phaseArrange")).toBe("Geordnet wird erst, wenn die Zettel aufgedeckt sind.");
  expect(key("NOT_ADMIN")).toBe("notAdmin");
  // no answer at all, no answer in time, and an answer the app does not know: none is silent
  expect(key("NETWORK")).toBe("arrangeNetwork");
  expect(i18n.t("reject.arrangeNetwork")).toBe(
    "Die Anfrage kam nicht beim Server an. Prüf die Verbindung und versuch es noch mal.",
  );
  expect(key("TIMEOUT")).toBe("arrangeTimeout");
  expect(i18n.t("reject.arrangeTimeout")).toBe(
    "Nach zwei Minuten kam keine Antwort der KI, das Warten ist beendet. Versuch es noch mal, oder ordnet von Hand.",
  );
  for (const code of ["WALL_NOT_FOUND", "INVALID_REQUEST", "UNKNOWN"] as const)
    expect(key(code)).toBe("arrangeUnknown");
  expect(i18n.t("reject.arrangeUnknown")).toBe(
    "Das Ordnen hat nicht geklappt: Der Server hat unerwartet geantwortet. Versuch es noch mal, oder ordnet von Hand.",
  );
  // a proposal none of whose notes is left: deleted, or in a group that is a person's by now
  expect(key("NOTHING_LEFT")).toBe("arrangeNothingLeft");
  expect(i18n.t("reject.arrangeNothingLeft")).toBe(
    "Vom Vorschlag ist nichts mehr übrig: Seine Zettel wurden inzwischen gelöscht oder liegen in Gruppen, die von Hand angelegt oder umbenannt wurden.",
  );
  expect(i18n.t("reject.arrangeNothingLeft", { lng: "en" })).toBe(
    "Nothing is left of the proposal: its notes were deleted meanwhile, or lie in groups that were made or renamed by hand.",
  );
  // no sentence about the AI's budget or a wall's runs speaks of a calendar day any more
  for (const lng of ["de", "en"]) {
    const sentences = (["arrangeBudget", "arrangeBudgetNoTime", "arrangeRuns"] as const).map((name) =>
      i18n.t(`reject.${name}`, { lng, when: "", runs: 6 }),
    );
    sentences.push(
      i18n.t("arrange.cancelHint", { lng, runs: 6 }),
      i18n.t("arrange.runsLeft", { lng, count: 1, runs: 6 }),
      i18n.t("arrange.runsLeft", { lng, count: 5, runs: 6 }),
      i18n.t("arrange.runsNone", { lng, runs: 6 }),
    );
    for (const sentence of sentences) expect(sentence).not.toMatch(/heute|am Tag|einem Tag|today|a day|one day/i);
  }
});

test("every way „Ordnen“ with the moderation's own key ends without a proposal names the provider and what now", () => {
  const key = (
    code: Extract<Rejected, { command: "arrange.key" }>["code"],
    provider: "mistral" | "openai" | "anthropic",
  ) => rejectKey({ code, command: "arrange.key", provider });
  const said = (which: string, provider: string, lng = "de") =>
    i18n.t(`reject.${which}` as "reject.keyRefused", { provider, lng });
  // the key is refused: enter it again. Anthropic also refuses the valid key of an account that keeps no data
  // there when it comes from a browser, and its sentence says so
  expect(key("KEY_REFUSED", "mistral")).toBe("keyRefused");
  expect(key("KEY_REFUSED", "openai")).toBe("keyRefused");
  expect(key("KEY_REFUSED", "anthropic")).toBe("keyRefusedBrowser");
  expect(said("keyRefused", "Mistral")).toBe(
    "Mistral hat den Schlüssel abgelehnt. Trag ihn unter „Mehr“ neu ein: Vielleicht ist er unvollständig kopiert, abgelaufen oder für diesen Dienst nicht freigegeben.",
  );
  expect(said("keyRefusedBrowser", "Anthropic")).toBe(
    "Anthropic hat den Schlüssel abgelehnt. Trag ihn unter „Mehr“ neu ein: Vielleicht ist er unvollständig kopiert, abgelaufen oder für diesen Dienst nicht freigegeben. Konten mit „Zero Data Retention“ lässt Anthropic aus einem Browser nicht fragen.",
  );
  expect(said("keyRefused", "OpenAI", "en")).toBe(
    "OpenAI refused the key. Enter it again under “More”: it may be copied incompletely, expired, or not allowed to use this service.",
  );
  // no credit, or a limit of what the account may spend
  expect(key("NO_CREDIT", "openai")).toBe("keyNoCredit");
  expect(said("keyNoCredit", "OpenAI")).toBe(
    "OpenAI hat nicht gerechnet: Das Konto hat kein Guthaben mehr, oder ein Ausgabenlimit ist erreicht. Lade dort Guthaben auf oder heb das Limit an. Von Hand ordnen geht immer.",
  );
  // the provider limits the rate, or is overloaded: wait and try again
  expect(key("RATE_LIMITED", "mistral")).toBe("keyRateLimited");
  expect(said("keyRateLimited", "Mistral")).toBe(
    "Mistral nimmt gerade keine weiteren Anfragen an: zu viele in kurzer Zeit, oder der Dienst ist überlastet. Warte einen Moment und versuch es noch mal.",
  );
  // no answer came, or one a browser may not read: both look the same from a page
  expect(key("UNREACHABLE", "mistral")).toBe("keyUnreachable");
  expect(said("keyUnreachable", "Mistral")).toBe(
    "Mistral war nicht zu erreichen, oder der Browser durfte die Antwort nicht lesen. Prüf die Verbindung und versuch es noch mal.",
  );
  // the model refused to answer; the request itself was not taken: both name the way back to Cloudflare
  expect(key("DECLINED", "anthropic")).toBe("keyDeclined");
  expect(said("keyDeclined", "Anthropic")).toBe(
    "Anthropic hat keine Antwort gegeben: Das Modell hat die Anfrage abgelehnt, aus Gründen des Anbieters. Ordnet von Hand, oder entferne den Schlüssel unter „Mehr“: Dann ordnet wieder Cloudflare.",
  );
  expect(key("REJECTED", "mistral")).toBe("keyRejected");
  expect(said("keyRejected", "Mistral")).toBe(
    "Mistral hat die Anfrage zurückgewiesen, nicht den Schlüssel. Das kann am Modell liegen, an der Form der Anfrage oder an einer Grenze deines Kontos dort. Ordnet von Hand, oder entferne den Schlüssel unter „Mehr“: Dann ordnet wieder Cloudflare.",
  );
  // no usable answer; the time is up; the part of the app that asks did not load
  expect(key("UNUSABLE", "openai")).toBe("keyUnusable");
  expect(said("keyUnusable", "OpenAI")).toBe(
    "OpenAI hat keine brauchbare Antwort gegeben. Versuch es noch mal, oder ordnet von Hand.",
  );
  expect(key("TIMEOUT", "openai")).toBe("keyTimeout");
  expect(said("keyTimeout", "OpenAI")).toBe(
    "Nach zwei Minuten war OpenAI nicht fertig: Die Anfragen sind abgebrochen. Versuch es noch mal, oder ordnet von Hand.",
  );
  expect(key("LOAD", "openai")).toBe("keyLoad");
  expect(said("keyLoad", "OpenAI")).toBe(
    "Der Teil der App, der mit deinem Schlüssel ordnet, ließ sich nicht laden. Prüf die Verbindung und versuch es noch mal.",
  );
  // every one of them exists in English too, and names the provider wherever the German one does
  for (const which of [
    "keyRefused",
    "keyRefusedBrowser",
    "keyNoCredit",
    "keyRateLimited",
    "keyRejected",
    "keyDeclined",
    "keyUnreachable",
    "keyUnusable",
    "keyTimeout",
    "keyLoad",
  ]) {
    const [de, en] = [said(which, "Mistral"), said(which, "Mistral", "en")];
    expect(en, which).not.toBe(de);
    expect(en.includes("Mistral"), which).toBe(de.includes("Mistral"));
    // no sentence leaves a placeholder standing
    expect(de + en, which).not.toMatch(/\{\{|\}\}/);
  }
});

test("an arrangement the wall refuses has sentences of its own, not a note's and not the clock's", () => {
  // refused twice because the wall kept changing: the proposal still stands
  expect(rejectKey({ code: "NOT_FOUND", command: "admin.arrange.apply" })).toBe("applyChanged");
  expect(rejectKey({ code: "CONFLICT", command: "admin.arrange.apply" })).toBe("applyChanged");
  expect(i18n.t("reject.applyChanged")).toBe(
    "Die Wand hat sich beim Anwenden zweimal geändert, und die Anordnung wurde nicht übernommen. Der Vorschlag steht noch: Versuch es noch mal.",
  );
  // an arrangement makes groups: the limit it meets is theirs
  expect(rejectKey({ code: "LIMIT", command: "admin.arrange.apply" })).toBe("limitGroups");
  // the phase: neither „invalid“ nor the groups' sentence
  expect(rejectKey({ code: "PHASE", command: "admin.arrange.apply" })).toBe("phaseArrange");
  expect(rejectKey({ code: "PHASE", command: "admin.arrange.undo" })).toBe("phaseArrange");
  // taking back a run that is not the wall's last one: not the clock's sentence
  expect(rejectKey({ code: "STALE", command: "admin.arrange.undo" })).toBe("staleUndo");
  expect(i18n.t("reject.staleUndo")).toBe(
    "Inzwischen wurde neu geordnet: Zurücknehmen lässt sich nur das letzte Ordnen. Die Wand zeigt, was jetzt gilt.",
  );
  expect(i18n.t("reject.staleUndo", { lng: "en" })).toBe(
    "The wall has been grouped anew meanwhile: only the last grouping can be undone. The wall shows what holds now.",
  );
  // the wall's brake, the role and a lost line read as for every change
  expect(rejectKey({ code: "DAY_SPENT", command: "admin.arrange.apply", resetsAt: 0 })).toBe("daySpent");
  expect(rejectKey({ code: "NOT_ADMIN", command: "admin.arrange.undo" })).toBe("notAdmin");
  expect(rejectKey({ code: "LOST", command: "admin.arrange.apply" })).toBe("lost");
});

test("a full wall says which kind of thing it is full of", () => {
  expect(rejectKey({ code: "LIMIT", command: "note.create" })).toBe("limit");
  expect(rejectKey({ code: "LIMIT", command: "group.create" })).toBe("limitGroups");
  expect(i18n.t("reject.limitGroups", { max: MAX_GROUPS })).toBe(
    "Mehr als 80\u00a0Gruppen passen nicht auf eine Wand. Lösch eine, dann ist wieder Platz.",
  );
  expect(i18n.t("reject.limit", { max: MAX_NOTES })).toMatch(/^Die Wand ist voll: Mehr als 500\u00a0Zettel/);
  expect(i18n.t("reject.limitGroups", { max: MAX_GROUPS, lng: "en" })).toBe(
    "A wall holds no more than 80 groups. Delete one to make room.",
  );
});

test("a change to something that is gone says whether it was a note or a group", () => {
  expect(rejectKey({ code: "NOT_FOUND", command: "note.update" })).toBe("notFound");
  expect(rejectKey({ code: "NOT_FOUND", command: "group.update" })).toBe("notFoundGroup");
  expect(i18n.t("reject.notFoundGroup")).toBe("Diese Gruppe gibt es nicht mehr: Jemand hat sie gelöscht.");
});

test("a note's text and its end are its author's: two sentences", () => {
  expect(rejectKey({ code: "NOT_AUTHOR", command: "note.update" })).toBe("notAuthorEdit");
  expect(rejectKey({ code: "NOT_AUTHOR", command: "note.delete" })).toBe("notAuthorDelete");
});

test("the wall's day is spent: the sentence says what happened and from what time of this device it goes on", () => {
  expect(rejectKey({ code: "DAY_SPENT", command: "note.create", resetsAt: 0 })).toBe("daySpent");
  expect(i18n.t("reject.daySpent", { time: "01:00" })).toBe(
    "Die Wand hat heute so viel gespeichert, wie eine Wand an einem Tag darf: Deine Änderung wurde nicht übernommen. Ab 01:00\u00a0Uhr geht es weiter.",
  );
  expect(i18n.t("reject.daySpent", { time: "01:00", lng: "en" })).toBe(
    "The wall has stored as much today as a wall may in one day: your change was not taken. It goes on at 01:00.",
  );
});

test("the phase and a stale control of the clock have sentences of their own", () => {
  // a group while the notes are hidden: the wall offers none then
  expect(rejectKey({ code: "PHASE", command: "group.create" })).toBe("phaseGroups");
  expect(rejectKey({ code: "PHASE", command: "group.update" })).toBe("phaseGroups");
  expect(i18n.t("reject.phaseGroups")).toBe("Gruppen gibt es erst, wenn die Zettel aufgedeckt sind.");
  // a control of the clock that crossed somebody else's revealing
  expect(rejectKey({ code: "PHASE", command: "admin.clock.pause" })).toBe("phaseClock");
  expect(i18n.t("reject.phaseClock")).toBe(
    "Die Zettel sind schon aufgedeckt: Die Uhr gibt es nur, solange verdeckt geschrieben wird.",
  );
  // any other command the phase refuses reads as the general sentence
  expect(rejectKey({ code: "PHASE", command: null })).toBe("invalid");
  // a control made for a clock that another control has changed meanwhile
  expect(rejectKey({ code: "STALE", command: "admin.clock.extend" })).toBe("staleClock");
  expect(i18n.t("reject.staleClock")).toBe(
    "Die Uhr wurde im selben Moment schon anders gestellt: Dein Schritt wurde nicht übernommen. Sie zeigt, was jetzt gilt.",
  );
  expect(i18n.t("reject.staleClock", { lng: "en" })).toBe(
    "The clock was changed at the same moment: your step was not taken. It shows what holds now.",
  );
});
