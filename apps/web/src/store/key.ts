// key.ts: the moderation's own key for an AI provider (PLAN.md 4.5), and the switch that offers providers whose
// model is not measured yet. Both live in this tab's memory and nowhere else: this store is not persisted, nothing
// here writes to localStorage, sessionStorage or a cookie, and the key enters no address, no log and no sentence.
// A reload forgets both. The key leaves this store in one direction only: into the header of a request to the
// provider it belongs to (lib/key-run.ts). No request to the app's own server and no frame of a wall's socket ever
// carries it (tests/own-key.spec.ts reads every one of them).
import { create } from "zustand";
import type { ProviderId } from "@ideabeam/arrange";

/** A key and the provider it is for. */
export type OwnKey = { provider: ProviderId; key: string };

type Key = {
  /** The switch that is no part of the interface (lib/key-switch.ts): this tab also offers the providers whose
   *  model is not measured yet. */
  unlocked: boolean;
  /** The key „Ordnen“ asks with, or null: the app's own server asks Cloudflare. */
  own: OwnKey | null;
  unlock(): void;
  /** „Übernehmen“: from now on „Ordnen“ asks this provider. */
  take(own: OwnKey): void;
  /** „Schlüssel entfernen“. */
  drop(): void;
};

export const useOwnKey = create<Key>()((set) => ({
  unlocked: false,
  own: null,
  unlock: () => set({ unlocked: true }),
  take: (own) => set({ own }),
  drop: () => set({ own: null }),
}));

/** What a key has to be to go into a header: one run of visible ASCII characters. Its shape beyond that is the
 *  provider's business: providers change their keys' form, and a check here would refuse a valid one. A key with a
 *  space or a line break in it was not copied whole. */
export function keyFault(typed: string): "missing" | "malformed" | undefined {
  const key = typed.trim();
  if (key === "") return "missing";
  return /^[\x21-\x7e]+$/.test(key) ? undefined : "malformed";
}
