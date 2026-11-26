// parts.tsx: what the legal texts are set with: the operator's postal block, a placeholder that shows marked until
// it is replaced, and a link that leaves the app. From RetroBeam's OperatorBlock (docs/HERKUNFT.md).
import type { ReactNode } from "react";
import { Icon } from "../sebaro/react/Icon";
import { isPlaceholder, OPERATOR } from "./operator";

/** A placeholder is loud on every screen until operator.ts is filled in: never shipped as if it were an address. */
export function PlaceholderField({ value }: { value: string }) {
  return isPlaceholder(value) ? <mark>{value}</mark> : <>{value}</>;
}

/** Name, postal address and e-mail of the operator, as a postal block. */
export function OperatorBlock({ emailLabel }: { emailLabel: string }) {
  return (
    <p>
      {OPERATOR.name}
      <br />
      {OPERATOR.careOf !== "" && (
        <>
          <PlaceholderField value={OPERATOR.careOf} />
          <br />
        </>
      )}
      <PlaceholderField value={OPERATOR.street} />
      <br />
      <PlaceholderField value={OPERATOR.city} />
      <br />
      {emailLabel} <PlaceholderField value={OPERATOR.email} />
    </p>
  );
}

/** The operator's e-mail address inside running text. */
export function OperatorEmail() {
  return <PlaceholderField value={OPERATOR.email} />;
}

/** A link that leaves the app: it opens in a tab of its own and ends in the external-link icon (sebaro core rule 19). */
export function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
      <Icon name="external-link--16" size={16} />
    </a>
  );
}
