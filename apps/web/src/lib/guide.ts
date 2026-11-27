// guide.ts: what to do now on a wall, as a sentence under its state: one per role, and it changes with how the wall
// stands. The owner looked at a wall with two people on it and asked how it goes on for the moderation; „2 Personen
// sind da.“ did not say. Pure: which sentence, as its key in the string tables (`wall.guide.*`); and which form the
// state sentence itself takes once the wall has groups (`wall.*`).
//
// While the notes are hidden (a step of hidden writing, PLAN.md 2.1) the sentence says so first: everyone writes for
// themselves and nobody reads along until the moderation reveals; to the moderation, that revealing is theirs. When
// the clock of the writing has run out, the clock's own sentence right above says so (lib/clock.ts), and this one
// says what it means: nothing is locked, and the moderation still decides when to reveal.
//
// Once the notes are revealed the moderation's next step is „Ordnen“ (PLAN.md 2.1), where there is something to
// arrange: enough notes that lie in no group a person made by hand or renamed. The sentence leads there and names
// doing it by hand as the equal way. After a run it says that the AI has arranged, what to do with the result, and
// where the way back is.
//
// In a step of a method that is about talking (`discuss`, PLAN-METHODEN.md), the sentence says what to talk about,
// once somebody else is there. In a step that votes (stage M2) it says how to vote, that nobody sees a ballot, and,
// to the moderation, that counting is theirs and shows the result to everybody at once; once counted, what now. A
// step that estimates (stage M3) says the same of a number, also in its first round, whose reasons are hidden like
// hidden writing: the estimate is what to do there. After a counted round it says what to talk about while another
// round follows, and where both rounds stand once none does. In a step of pairs or small groups (stage M4) it says to
// talk in the team and who reads its notes, and to the moderation where the map of the teams is; in the hidden
// writing before the teams meet, that the teams come next; in a step where the teams present, what that is. Stage M5:
// a vote that ranks says how to rank; a step that reveals by turn says who reveals and how; a step in which somebody
// presents and nobody writes says to listen; a step that decides says who agrees on the actions and how.
import { ARRANGE_MIN_NOTES, type StepType } from "@ideabeam/shared";

/** What the sentence depends on. */
export type Standing = {
  /** this person moderates */
  admin: boolean;
  /** how many notes lie on the wall; while they are hidden, the others' too, which this browser only counts */
  notes: number;
  /** how many people the wall knows, this one included: 1 means nobody else has come yet */
  people: number;
  /** how many groups the wall has; none when left out */
  groups?: number;
  /** how many of the notes lie in a group */
  grouped?: number;
  /** how many of the groups have no title yet */
  untitled?: number;
  /** the notes are hidden: the wall has reached no step that shows them */
  hidden?: boolean;
  /** what the step the wall is in does; left out, a step of writing and sorting */
  step?: StepType;
  /** the clock of the writing has run out */
  timeUp?: boolean;
  /** how many of the notes the AI may arrange: those in no group a person made by hand or renamed (lib/arrange.ts);
   *  none when left out */
  arrangeable?: number;
  /** The AI arranged the wall last, and the run can still be taken back: `fresh` while nothing has changed since
   *  (taking it back acts at once, from the action zone), `changed` after that (it asks first, from „Mehr“). null or
   *  left out: no such run. */
  arranged?: "fresh" | "changed" | null;
  /** In a step that votes: whether this person's ballot is stored, whether the vote is counted, and whether it is
   *  an estimate. */
  vote?: { cast: boolean; counted: boolean; estimate?: boolean; rank?: boolean } | null;
  /** In a step that reveals by turn (stage M5): how many notes are left to reveal. null or left out: no such step. */
  turn?: { left: number } | null;
  /** After a counted estimate, outside a step that votes: another round of estimates follows (`talk`), or none does
   *  (`result`). null or left out: the wall has counted no estimate. */
  estimates?: "talk" | "result" | null;
  /** The step works in teams (stage M4): `team`. The step is the presenting of the teams' results: `present`. The
   *  hidden writing before a step of teams: `before`. Stage M5, where the small groups are no pairs that grew into
   *  fours by themselves: the presenting of the small groups (`presentGroups`), the hidden writing before them, which
   *  waits for „Weiter“ (`beforeGroups`). Left out: none of these. */
  teams?: "team" | "present" | "before" | "presentGroups" | "beforeGroups" | null;
};

export type GuideKey =
  | "adminAloneEmpty"
  | "adminAloneNotes"
  | "adminEmpty"
  | "adminNotes"
  | "adminSorting"
  | "adminSorted"
  | "adminArrange"
  | "adminArrangeRest"
  | "adminArrangedFresh"
  | "adminArranged"
  | "memberAlone"
  | "memberEmpty"
  | "memberNotes"
  | "memberSorting"
  | "memberSorted"
  | "adminHiddenAlone"
  | "adminHiddenEmpty"
  | "adminHiddenNotes"
  | "adminHiddenOver"
  | "memberHiddenAlone"
  | "memberHidden"
  | "memberHiddenOver"
  | "adminDiscuss"
  | "memberDiscuss"
  | "adminVote"
  | "adminVoteCast"
  | "adminCounted"
  | "memberVote"
  | "memberVoteCast"
  | "memberCounted"
  | "adminEstimate"
  | "adminEstimateCast"
  | "adminEstimated"
  | "memberEstimate"
  | "memberEstimateCast"
  | "memberEstimated"
  | "adminEstimateTalk"
  | "memberEstimateTalk"
  | "adminEstimateResult"
  | "memberEstimateResult"
  | "adminTeam"
  | "memberTeam"
  | "adminPresent"
  | "memberPresent"
  | "adminBeforeTeams"
  | "memberBeforeTeams"
  | "adminRank"
  | "adminRankCast"
  | "memberRank"
  | "memberRankCast"
  | "adminTurn"
  | "adminTurnDone"
  | "memberTurn"
  | "adminListen"
  | "memberListen"
  | "adminDecide"
  | "memberDecide"
  | "adminBeforeGroups"
  | "memberBeforeGroups"
  | "adminPresentGroups"
  | "memberPresentGroups";

/** The sentence that says what to do now. Alone, the next step is to bring the others in; with others, to write;
 *  once notes lie there, to put what belongs together into a group; once groups stand, to move the rest together
 *  and to name every group; and when every note lies in a named group, to write on if something is missing.
 *  While the notes are hidden: to write, and who reveals; once the time is up, that it is, and what the moderation
 *  can do about it.
 *
 *  To the moderation of a revealed wall with others on it: while enough notes lie there for the AI to arrange,
 *  „Ordnen“ is the next step, and by hand is the equal way (`adminArrange`; with groups on the wall already, of
 *  which a run leaves alone those made by hand or renamed: `adminArrangeRest`). After a run: what the AI did and
 *  what to do with it, with the way back in the action zone (`adminArrangedFresh`) or, once the wall has changed
 *  since, in „Mehr“ (`adminArranged`). */
export function guide(standing: Standing): GuideKey {
  const { admin, notes, people, groups = 0, grouped = 0, untitled = 0, hidden = false, timeUp = false } = standing;
  const { arrangeable = 0, arranged = null } = standing;
  const alone = people <= 1;
  const empty = notes === 0;
  // a step that votes: how, and who counts. First, since the first estimate is a step that votes while the reasons
  // beside it are hidden
  const vote = standing.vote ?? null;
  if (vote !== null) {
    if (vote.estimate === true) {
      const state = vote.counted ? "Estimated" : vote.cast ? "EstimateCast" : "Estimate";
      return `${admin ? "admin" : "member"}${state}`;
    }
    if (vote.rank === true && !vote.counted) return `${admin ? "admin" : "member"}${vote.cast ? "RankCast" : "Rank"}`;
    const state = vote.counted ? "Counted" : vote.cast ? "VoteCast" : "Vote";
    return `${admin ? "admin" : "member"}${state}`;
  }
  // a step that reveals by turn: the moderation reveals, one note at a time
  const turn = standing.turn ?? null;
  if (turn !== null) return admin ? (turn.left > 0 ? "adminTurn" : "adminTurnDone") : "memberTurn";
  // somebody presents, and nobody writes yet; the moderation agrees on the actions
  if (standing.step === "present") return admin ? "adminListen" : "memberListen";
  if (standing.step === "decide") return admin ? "adminDecide" : "memberDecide";
  // a step of teams: talk in the team, and who reads its notes; the moderation has the map
  const teams = standing.teams ?? null;
  if (teams === "team") return admin ? "adminTeam" : "memberTeam";
  if (hidden && teams === "before" && !alone) return admin ? "adminBeforeTeams" : "memberBeforeTeams";
  if (hidden && teams === "beforeGroups" && !alone) return admin ? "adminBeforeGroups" : "memberBeforeGroups";
  if (hidden) {
    if (admin) {
      // alone, the link comes first, whatever the clock says
      if (alone) return "adminHiddenAlone";
      if (timeUp) return "adminHiddenOver";
      return empty ? "adminHiddenEmpty" : "adminHiddenNotes";
    }
    if (alone) return "memberHiddenAlone";
    return timeUp ? "memberHiddenOver" : "memberHidden";
  }
  // after a counted estimate: what to talk about before the next round, or where both rounds stand
  const estimates = standing.estimates ?? null;
  if (estimates !== null && !alone) {
    return `${admin ? "admin" : "member"}${estimates === "talk" ? "EstimateTalk" : "EstimateResult"}`;
  }
  // the teams present what they found
  if (teams === "present" && !alone) return admin ? "adminPresent" : "memberPresent";
  if (teams === "presentGroups" && !alone) return admin ? "adminPresentGroups" : "memberPresentGroups";
  // a step to talk the result through, with others on the wall
  if (standing.step === "discuss" && !alone) return admin ? "adminDiscuss" : "memberDiscuss";
  // how far the sorting is: no group yet, under way, or every note in a group that has a name
  const sorting = groups === 0 ? "Notes" : grouped < notes || untitled > 0 ? "Sorting" : "Sorted";
  if (admin) {
    if (alone) return empty ? "adminAloneEmpty" : "adminAloneNotes";
    if (empty) return "adminEmpty";
    if (arranged !== null) return arranged === "fresh" ? "adminArrangedFresh" : "adminArranged";
    if (arrangeable >= ARRANGE_MIN_NOTES) return groups === 0 ? "adminArrange" : "adminArrangeRest";
    return `admin${sorting}`;
  }
  if (alone) return "memberAlone";
  return empty ? "memberEmpty" : `member${sorting}`;
}

/** The form of the state sentence's first half: how many notes, and what the groups hold.
 *  - `none`: „Noch keine Zettel.“
 *  - `plain`: „12 Zettel.“ (a wall without groups)
 *  - `allGrouped`: „12 Zettel in 3 Gruppen.“ (every note lies in a group)
 *  - `someGrouped`: „12 Zettel, 8 davon in 3 Gruppen.“
 *  - `noneGrouped`: „12 Zettel und 3 leere Gruppen.“
 *  - `noNotesGroups`: „Noch keine Zettel, 3 leere Gruppen.“
 *  While the notes are hidden there are no groups, and the sentence says that they are hidden:
 *  - `hiddenNone`: „Verdecktes Schreiben: noch keine Zettel.“
 *  - `hiddenNotes`: „Verdecktes Schreiben: 12 Zettel.“ (one's own and the others')
 *  In a step of teams (stage M4) the sentence counts the person's team, its notes being those this browser holds:
 *  - `teamNone`: „Euer Team: noch keine Zettel.“
 *  - `teamNotes`: „Euer Team: 3 Zettel.“ */
export type SummaryKey =
  | "none"
  | "plain"
  | "allGrouped"
  | "someGrouped"
  | "noneGrouped"
  | "noNotesGroups"
  | "hiddenNone"
  | "hiddenNotes"
  | "teamNone"
  | "teamNotes";

export function summary({
  notes,
  groups = 0,
  grouped = 0,
  hidden = false,
  teams = null,
}: Pick<Standing, "notes" | "groups" | "grouped" | "hidden" | "teams">): SummaryKey {
  if (hidden && teams === "team") return notes === 0 ? "teamNone" : "teamNotes";
  if (hidden) return notes === 0 ? "hiddenNone" : "hiddenNotes";
  if (groups === 0) return notes === 0 ? "none" : "plain";
  if (notes === 0) return "noNotesGroups";
  if (grouped === 0) return "noneGrouped";
  return grouped >= notes ? "allGrouped" : "someGrouped";
}
