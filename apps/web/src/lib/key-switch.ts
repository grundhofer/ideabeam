// key-switch.ts: the switch that offers the providers of „Eigener Schlüssel“ whose model is not measured yet
// (PLAN.md 4.5, 7.2 no. 20). It is no part of the interface: the owner uses it to try his own key before the
// measurements exist, and the end-to-end tests use it. It is the part `eigener-schluessel` of an address's
// fragment: `/w/<id>#eigener-schluessel`. Like the admin token of a moderation link (lib/links.ts) it is read once
// and taken out of the address at once, and it is kept in the tab's memory alone (store/key.ts): it cannot be
// bookmarked with the wall, it is not stored, and a reload switches it off again.
export const KEY_SWITCH = "eigener-schluessel";

/** A fragment without the switch, or null: the fragment does not carry it, and stays as it is. */
export function takeKeySwitch(hash: string): string | null {
  const parts = hash.replace(/^#/, "").split("&");
  if (!parts.includes(KEY_SWITCH)) return null;
  const rest = parts.filter((part) => part !== "" && part !== KEY_SWITCH);
  return rest.length === 0 ? "" : `#${rest.join("&")}`;
}

/** Adopts the switch from this tab's address: rewrites the current history entry without it, so neither the address
 *  bar nor Back and Forward keep it, and says `on`. */
export function adoptKeySwitch(on: () => void): void {
  const hash = takeKeySwitch(location.hash);
  if (hash === null) return;
  // history.state carries the router's own bookkeeping of the entry: it stays
  history.replaceState(history.state, "", `${location.pathname}${location.search}${hash}`);
  on();
}
