import { expect, test } from "vitest";
import { ARRANGE_MIN_NOTES } from "@ideabeam/shared";
import i18n from "../i18n";
import { guide, summary, type Standing } from "./guide";

const say = (standing: Standing, lang: "de" | "en" = "de") => i18n.t(`wall.guide.${guide(standing)}`, { lng: lang });

test("the moderation is told what to do now: bring the team in, then write, then sort", () => {
  expect(say({ admin: true, notes: 0, people: 1 })).toBe(
    "Du moderierst: Schick den Link an dein Team, dann schreibt ihr alle eure Ideen auf Zettel.",
  );
  expect(say({ admin: true, notes: 3, people: 1 })).toBe(
    "Du moderierst: Schick den Link an dein Team, damit alle mitschreiben.",
  );
  expect(say({ admin: true, notes: 0, people: 2 })).toBe(
    "Du moderierst: Jetzt schreiben alle ihre Ideen auf Zettel, du auch.",
  );
  expect(say({ admin: true, notes: 12, people: 5 })).toBe(
    "Du moderierst: Alle schreiben weiter. Was zusammengehört, kommt mit „Neue Gruppe“ in einen Rahmen.",
  );
});

test("everybody else is told to write, and later to sort; alone, to pass the link on", () => {
  expect(say({ admin: false, notes: 0, people: 3 })).toBe("Schreib deine Ideen auf Zettel.");
  expect(say({ admin: false, notes: 1, people: 3 })).toBe(
    "Schreib weitere Ideen auf Zettel. Was zusammengehört, kommt mit „Neue Gruppe“ in einen Rahmen.",
  );
  for (const notes of [0, 4]) {
    expect(say({ admin: false, notes, people: 1 })).toBe(
      "Schreib deine Ideen auf Zettel, und schick den Link weiter, wenn noch jemand fehlt.",
    );
  }
});

test("once groups stand, the next step is to move the rest together and to name every group", () => {
  // a note still lies outside every group
  expect(say({ admin: true, notes: 12, people: 5, groups: 3, grouped: 8, untitled: 0 })).toBe(
    "Du moderierst: Schiebt zusammen, was zusammengehört, und gebt jeder Gruppe einen Namen.",
  );
  // every note lies in a group, but a group has no name yet
  expect(say({ admin: false, notes: 12, people: 5, groups: 3, grouped: 12, untitled: 1 })).toBe(
    "Schieb zusammen, was zusammengehört, und gib jeder Gruppe einen Namen.",
  );
  // a group alone, still empty, is a beginning
  expect(guide({ admin: false, notes: 2, people: 2, groups: 1, grouped: 0, untitled: 1 })).toBe("memberSorting");
});

test("every note in a named group: the wall is sorted, and the sentence says so", () => {
  const sorted = { notes: 12, people: 5, groups: 3, grouped: 12, untitled: 0 };
  expect(say({ admin: true, ...sorted })).toBe(
    "Du moderierst: Jeder Zettel liegt in einer benannten Gruppe. Schreibt weiter, wenn noch etwas fehlt.",
  );
  expect(say({ admin: false, ...sorted })).toBe(
    "Jeder Zettel liegt in einer benannten Gruppe. Schreib weiter, wenn noch etwas fehlt.",
  );
  // alone, the link comes first, whatever the groups say; and an empty wall has nothing to sort
  expect(guide({ admin: true, ...sorted, people: 1 })).toBe("adminAloneNotes");
  expect(guide({ admin: true, people: 3, notes: 0, groups: 2, grouped: 0, untitled: 0 })).toBe("adminEmpty");
});

test("the sentences exist in English too", () => {
  expect(say({ admin: true, notes: 0, people: 1 }, "en")).toBe(
    "You facilitate: send the link to your team, then all of you write your ideas on notes.",
  );
  expect(say({ admin: false, notes: 0, people: 2 }, "en")).toBe("Write your ideas on notes.");
  expect(say({ admin: false, notes: 4, people: 2, groups: 2, grouped: 1, untitled: 0 }, "en")).toBe(
    "Move together what belongs together, and give every group a name.",
  );
});

test("once enough notes lie there for the AI, the moderation's next step is „Ordnen“, and by hand is the equal way", () => {
  // no group yet, and at least as many notes as a run takes: „Ordnen“ first, then how it goes by hand
  const ready = { admin: true, notes: 12, people: 5, arrangeable: 12 };
  expect(say(ready)).toBe(
    "Du moderierst: Wenn alle fertig sind, schlägt „Ordnen“ Gruppen mit Überschriften vor. Von Hand geht es genauso: Was zusammengehört, kommt mit „Neue Gruppe“ in einen Rahmen.",
  );
  expect(say(ready, "en")).toBe(
    "You facilitate: when everyone is done, “Group notes” proposes groups with headings. By hand works just as well: what belongs together goes into a frame with “New group”.",
  );
  // exactly as many as a run takes is enough; one fewer, and the sentence stays with doing it by hand
  expect(guide({ ...ready, notes: ARRANGE_MIN_NOTES, arrangeable: ARRANGE_MIN_NOTES })).toBe("adminArrange");
  expect(guide({ ...ready, notes: 5, arrangeable: 5 })).toBe("adminNotes");
  // groups that are a person's stand already, made by hand or renamed: a run leaves them alone and arranges the rest
  expect(say({ ...ready, groups: 2, grouped: 4, arrangeable: 8 })).toBe(
    "Du moderierst: „Ordnen“ schlägt Gruppen für die Zettel vor, die in keiner von Hand angelegten oder umbenannten Gruppe liegen. Von Hand geht es genauso: Schiebt zusammen, was zusammengehört.",
  );
  expect(say({ ...ready, groups: 2, grouped: 4, arrangeable: 8 }, "en")).toBe(
    "You facilitate: “Group notes” proposes groups for the notes that lie in no group made or renamed by hand. By hand works just as well: move together what belongs together.",
  );
  // nearly everything lies in such groups: too little is left for a run
  expect(guide({ ...ready, groups: 2, grouped: 9, arrangeable: 3 })).toBe("adminSorting");
  // alone, the link comes first; an empty wall has nothing to arrange; while the notes are hidden, revealing is next
  expect(guide({ ...ready, people: 1 })).toBe("adminAloneNotes");
  expect(guide({ admin: true, notes: 0, people: 5, arrangeable: 0 })).toBe("adminEmpty");
  expect(guide({ ...ready, hidden: true })).toBe("adminHiddenNotes");
  // „Ordnen“ is the moderation's: nobody else is led to it
  expect(guide({ ...ready, admin: false })).toBe("memberNotes");
});

test("after a run the moderation reads that the AI has arranged, and where the way back is", () => {
  const done = { admin: true, notes: 12, people: 5, groups: 3, grouped: 12, untitled: 0, arrangeable: 12 };
  // nothing has changed since: „Rückgängig“ stands in the action zone and acts at once
  expect(say({ ...done, arranged: "fresh" })).toBe(
    "Du moderierst: Die KI hat geordnet. Passt es nicht, nimmt „Rückgängig“ es sofort zurück. Sonst schiebt um und benennt um, was nicht trifft.",
  );
  // the wall has changed since: the way back is in „Mehr“
  expect(say({ ...done, arranged: "changed" })).toBe(
    "Du moderierst: Die KI hat geordnet. Schiebt um und benennt um, was nicht trifft. Zurücknehmen lässt sich das Ordnen noch unter „Mehr“.",
  );
  expect(say({ ...done, arranged: "changed" }, "en")).toBe(
    "You facilitate: the AI has grouped the notes. Move and rename whatever is not right. The grouping can still be undone under “More”.",
  );
  // everybody else reads what the groups say, as before
  expect(guide({ ...done, admin: false, arranged: "changed" })).toBe("memberSorted");
  // without a run that can be taken back, a sorted wall is a sorted wall
  expect(guide({ ...done, arrangeable: 0, arranged: null })).toBe("adminSorted");
});

test("while the notes are hidden everybody is told that nobody reads along, and who reveals", () => {
  const hidden = { hidden: true };
  // everybody else: write; nobody reads along until the moderation reveals
  expect(say({ admin: false, notes: 0, people: 3, ...hidden })).toBe(
    "Schreib deine Ideen auf Zettel. Niemand liest mit, bis die Moderation aufdeckt.",
  );
  // the sentence does not change with the notes: there is nothing to sort before they are revealed
  expect(guide({ admin: false, notes: 7, people: 3, ...hidden })).toBe("memberHidden");
  expect(say({ admin: false, notes: 2, people: 1, ...hidden })).toBe(
    "Schreib deine Ideen auf Zettel, und schick den Link weiter, wenn noch jemand fehlt. Niemand liest mit, bis die Moderation aufdeckt.",
  );
  // the moderation: revealing is theirs
  expect(say({ admin: true, notes: 0, people: 1, ...hidden })).toBe(
    "Du moderierst: Schick den Link an dein Team. Alle schreiben für sich, und niemand liest mit, bis du aufdeckst.",
  );
  expect(say({ admin: true, notes: 0, people: 3, ...hidden })).toBe(
    "Du moderierst: Jetzt schreiben alle ihre Ideen auf Zettel, du auch. Niemand liest mit, bis du aufdeckst.",
  );
  expect(say({ admin: true, notes: 7, people: 3, ...hidden })).toBe(
    "Du moderierst: Alle schreiben für sich, niemand liest mit. Wenn alle fertig sind, zeigt „Aufdecken“ allen jeden Zettel.",
  );
});

// the clock's own sentence, right above, says that the time is up: this one says what that means
test("when the clock has run out the sentence says that nothing is locked, and that the moderation still decides", () => {
  const over = { hidden: true, timeUp: true };
  expect(say({ admin: true, notes: 7, people: 3, ...over })).toBe(
    "Du moderierst: Nichts ist gesperrt, alle können weiterschreiben. Deck auf, wenn alle fertig sind, oder gib fünf Minuten mehr.",
  );
  expect(say({ admin: false, notes: 7, people: 3, ...over })).toBe(
    "Du kannst weiterschreiben, bis die Moderation aufdeckt.",
  );
  // alone, the link comes first, whatever the clock says
  expect(guide({ admin: true, notes: 0, people: 1, ...over })).toBe("adminHiddenAlone");
  expect(guide({ admin: false, notes: 0, people: 1, ...over })).toBe("memberHiddenAlone");
  // a clock that has run out says nothing once the notes are revealed
  expect(guide({ admin: true, notes: 7, people: 3, timeUp: true })).toBe("adminNotes");
});

test("the sentences of the hidden writing exist in English too", () => {
  expect(say({ admin: false, notes: 0, people: 3, hidden: true }, "en")).toBe(
    "Write your ideas on notes. Nobody reads along until the facilitator reveals the notes.",
  );
  expect(say({ admin: true, notes: 7, people: 3, hidden: true }, "en")).toBe(
    "You facilitate: everyone writes on their own, nobody reads along. When everyone is done, “Reveal” shows every note to everyone.",
  );
  expect(say({ admin: true, notes: 7, people: 3, hidden: true, timeUp: true }, "en")).toBe(
    "You facilitate: nothing is locked, everyone can keep writing. Reveal the notes when everyone is done, or give five more minutes.",
  );
});

test("the state sentence knows groups: how many notes, and how many of them lie in how many groups", () => {
  expect(summary({ notes: 0 })).toBe("none");
  expect(summary({ notes: 12 })).toBe("plain");
  expect(summary({ notes: 12, groups: 3, grouped: 12 })).toBe("allGrouped");
  expect(summary({ notes: 12, groups: 3, grouped: 8 })).toBe("someGrouped");
  expect(summary({ notes: 12, groups: 3, grouped: 0 })).toBe("noneGrouped");
  expect(summary({ notes: 0, groups: 3, grouped: 0 })).toBe("noNotesGroups");
});

test("while the notes are hidden the state sentence names the phase and counts every note, also the others'", () => {
  expect(summary({ notes: 0, hidden: true })).toBe("hiddenNone");
  expect(summary({ notes: 7, hidden: true })).toBe("hiddenNotes");
  expect(i18n.t("wall.hiddenNone")).toBe("Verdecktes Schreiben: noch keine Zettel.");
  expect(i18n.t("wall.hiddenNotes", { count: 7 })).toBe("Verdecktes Schreiben: 7\u00a0Zettel.");
  expect(i18n.t("wall.hiddenNotes", { count: 1, lng: "en" })).toBe("Hidden writing: 1 note.");
});
