// operator.ts: the one place the deployment's legal facts live. § 18 Abs. 1 MStV asks every public web offer for a
// name and a postal address, commercial or not, and Art. 13(1)(a) GDPR asks the privacy notice for the controller's
// contact: the imprint, the privacy notice and the accessibility statement (its way to report a barrier) read from
// here. From FokusBeam, there from RetroBeam (docs/HERKUNFT.md); the operator is the same person.
//
// A value in square brackets is a placeholder: it renders marked, the legal pages say that they are a draft, and
// `pnpm release:check` refuses a release while one is left. Whoever runs a build of their own replaces all of them
// with their own details.
//
// `careOf` carries the "c/o" line of an address service. It is an address a summons reaches (a P.O. box would not
// be), and the line is load-bearing: post only arrives when it is addressed with it. Leave it empty when the
// address needs no such line.
export interface Operator {
  readonly name: string;
  readonly careOf: string;
  readonly street: string;
  readonly city: string;
  readonly email: string;
}

export const OPERATOR: Operator = {
  name: "Sebastian Grundhöfer",
  careOf: "c/o Impressumservice Dein-Impressum",
  street: "Stettiner Str. 41",
  city: "35410 Hungen",
  email: "info@sebaro-ventures.de",
};

/** The day the privacy notice was last changed, as an ISO date: its date line. */
export const NOTICE_DATE = "2026-11-26";

/** The day the accessibility statement was written against the checks of that day's code, as an ISO date: its date
 *  line. A change of what the statement says (a check added, a limitation found or removed) moves it. */
export const STATEMENT_DATE = "2026-11-26";

/** The day the operator read the three legal texts (imprint, privacy notice, accessibility statement) and released
 *  them, as an ISO date. Until then they are a draft: the wording was checked against what the app does, not by its
 *  operator and not by a lawyer. */
// 2026-11-26: compared against a generator's checklist (Art. 13 GDPR items, contact by e-mail, changes) by the lead
// session on the operator's instruction (PLAN.md 7.2, nos. 29 and 31), and released with his word for the start. No
// lawyer has read the texts.
export const NOTICE_REVIEWED = "2026-11-26";

/** The day the settings of the Cloudflare zone named in the privacy notice were confirmed in the dashboard (no Web
 *  Analytics beacon, no bot-protection cookies, no challenge pages), as an ISO date. They are no part of the source. */
export const CLOUDFLARE_SETTINGS_CHECKED = "2026-11-26";

/** AGPL § 13: the footer's source offer links here, so a changed build points at the repository that holds ITS
 *  source, not at the upstream one. Without a slash at the end. */
export const REPO_URL = "https://github.com/grundhofer/ideabeam";

export function isPlaceholder(value: string): boolean {
  return value.startsWith("[") && value.endsWith("]");
}

/** The legal pages are a draft while any placeholder is left. */
export const DRAFT = [
  OPERATOR.careOf,
  OPERATOR.street,
  OPERATOR.city,
  OPERATOR.email,
  NOTICE_REVIEWED,
  CLOUDFLARE_SETTINGS_CHECKED,
  REPO_URL,
].some(isPlaceholder);
