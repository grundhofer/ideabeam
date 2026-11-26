// walls.ts: the walls this browser has been on, kept in localStorage on this device only. There is no account, so
// this is all that leads back to a wall: its address, the name used there and the session key that makes a return
// the same person. Beside them stand the admin tokens this browser holds: of a wall it made, or of a moderation
// link opened in it. A change of the stored shape raises `version` and gets a `migrate` function beside it, so
// walls stored by an older build are never dropped. Another tab of this browser writes the same key: this tab
// follows it, so neither overwrites what the other has stored, a wall's admin token first of all.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateSessionKey } from "@ideabeam/shared";
import { id as product } from "../../sebaro.product.json";

export type KnownWall = {
  id: string;
  /** the wall's question, as its last `sync` gave it */
  question: string;
  /** the display name this browser uses on the wall; none while it has made the wall and not joined it yet */
  as?: string;
  /** minted here before the first join: the same key is the same person */
  sessionKey: string;
  /** when this browser was last on it, or made it: an ISO date and time */
  visited: string;
};

type Walls = {
  /** the name typed last, offered again at the next wall */
  displayName: string;
  /** the walls, the one visited last first */
  walls: KnownWall[];
  /** the admin tokens, by wall. A token is the whole right to moderate: it leaves this storage only in the join and
   *  in the moderation link its holder copies */
  adminTokens: Record<string, string>;
  /** Notes a visit: adds the wall or renews what is known about it, and puts it first. A session key and a name
   *  that are already stored stay unless new ones are given; a wall that is new takes the key it is given, or a
   *  fresh one. */
  remember(wall: { id: string; question: string; as?: string; sessionKey?: string }): KnownWall;
  /** Keeps a wall's admin token. One that is already held is never replaced: nothing changes a wall's token, so a
   *  different one can only be wrong, and anybody who knows the wall's address can write such a link. Taking it
   *  would cost this browser the real one. */
  keepToken(id: string, adminToken: string): void;
  /** Drops a wall that is gone, and its token. */
  forget(id: string): void;
};

const NAME = `${product}-walls`;

export const useWalls = create<Walls>()(
  persist(
    (set, get) => ({
      displayName: "",
      walls: [],
      adminTokens: {},
      remember({ id, question, as, sessionKey }) {
        const before = get().walls.find((wall) => wall.id === id);
        const wall: KnownWall = {
          id,
          question,
          sessionKey: before?.sessionKey ?? sessionKey ?? generateSessionKey(),
          visited: new Date().toISOString(),
        };
        const name = as ?? before?.as;
        if (name !== undefined) wall.as = name;
        set({
          displayName: as ?? get().displayName,
          walls: [wall, ...get().walls.filter((other) => other.id !== id)],
        });
        return wall;
      },
      keepToken(id, adminToken) {
        if (get().adminTokens[id] !== undefined) return;
        set({ adminTokens: { ...get().adminTokens, [id]: adminToken } });
      },
      forget(id) {
        const adminTokens = { ...get().adminTokens };
        delete adminTokens[id];
        set({ walls: get().walls.filter((wall) => wall.id !== id), adminTokens });
      },
    }),
    {
      name: NAME,
      version: 1,
      partialize: ({ displayName, walls, adminTokens }) => ({ displayName, walls, adminTokens }),
    },
  ),
);

// what another tab stored is read again here; the event never fires in the tab that wrote
window.addEventListener("storage", (event) => {
  if (event.key === NAME) void useWalls.persist.rehydrate();
});
