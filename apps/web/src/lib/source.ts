// source.ts: where the footer's „GitHub“ leads. AGPL § 13 asks a version that is used over a network to offer its
// users the source of that version: the link leads to the commit that is running. The commit comes in at build time
// (VITE_COMMIT_SHA, set by scripts/production-deploy.sh and scripts/preview-deploy.sh); without it the
// link leads to the repository, which is right for local runs and tests. While the repository's address is a placeholder (src/content/operator.ts) there is no link,
// and no release (scripts/release-check.ts).
import { isPlaceholder } from "../content/operator";

/** The address of the running version's source, or null while the repository has no address yet. */
export function sourceUrl(repository: string, commit: unknown): string | null {
  if (isPlaceholder(repository) || repository === "") return null;
  return typeof commit === "string" && /^[0-9a-f]{7,40}$/.test(commit) ? `${repository}/tree/${commit}` : repository;
}
