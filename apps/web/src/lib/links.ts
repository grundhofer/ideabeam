// links.ts: the two links of a wall. From RetroBeam's lib/adminLink.ts (docs/HERKUNFT.md). The wall's link,
// `/w/<id>`, is the one to hand out: whoever has it may join. The moderation link, `/w/<id>#admin=<token>`, carries
// the admin token, which is the whole right to moderate. So the token rides in the FRAGMENT, the one part of an
// address a browser never sends anywhere: not in a request, not in a Referer, not to any log. Only this script reads
// it, hands it to the browser's storage and takes it out of the address bar again.
import { adminTokenSchema, WALL_ID_PATTERN } from "@ideabeam/shared";

const ADMIN_PARAM = "admin";

/** The link to hand out. Built from the id alone, never from an address bar that may still hold a fragment. */
export function wallLink(origin: string, wallId: string): string {
  return `${origin}/w/${wallId}`;
}

/** The moderation link: whoever opens it moderates the wall. */
export function adminLink(origin: string, wallId: string, adminToken: string): string {
  return `${wallLink(origin, wallId)}#${ADMIN_PARAM}=${adminToken}`;
}

/** The wall a path names, or null: another view, or an id of another shape than a wall's. */
export function wallIdOf(pathname: string): string | null {
  const [, id = ""] = /^\/w\/([^/]+)\/?$/.exec(pathname) ?? [];
  return WALL_ID_PATTERN.test(id) ? id : null;
}

export type AdminFragment = {
  /** the token, if the fragment carried a well-formed one */
  token: string | null;
  /** what the fragment becomes once every admin= part is gone: "" or "#…" */
  hash: string;
};

/** Pulls every `admin=` part out of a fragment. Null when there is none, so a fragment that is not ours stays as it
 *  is. A malformed value is taken out all the same: a token cut short when it was pasted is no less a secret-shaped
 *  string that should not stand in the address bar. */
export function takeAdminFragment(hash: string): AdminFragment | null {
  const parts = hash.replace(/^#/, "").split("&");
  const ours = parts.filter((part) => part === ADMIN_PARAM || part.startsWith(`${ADMIN_PARAM}=`));
  if (ours.length === 0) return null;
  const rest = parts.filter((part) => part !== "" && !ours.includes(part));
  const value = ours[0]?.slice(ADMIN_PARAM.length + 1) ?? "";
  return {
    token: ours.length === 1 && adminTokenSchema.safeParse(value).success ? value : null,
    hash: rest.length === 0 ? "" : `#${rest.join("&")}`,
  };
}

/** Adopts a moderation link opened in this tab: rewrites the current history entry without the token, so neither the
 *  address bar nor Back and Forward keep it, and hands a well-formed token of a wall's address to `keep`. The wall
 *  still decides: the join sends what is stored, and a wrong token simply joins as everybody else. */
export function adoptAdminLink(keep: (wallId: string, adminToken: string) => void): void {
  const taken = takeAdminFragment(location.hash);
  if (taken === null) return;
  // history.state carries the router's own bookkeeping of the entry: it stays
  history.replaceState(history.state, "", `${location.pathname}${location.search}${taken.hash}`);
  const wallId = wallIdOf(location.pathname);
  if (wallId !== null && taken.token !== null) keep(wallId, taken.token);
}
