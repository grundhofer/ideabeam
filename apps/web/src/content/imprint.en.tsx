// imprint.en.tsx: the English imprint, a translation of imprint.de.tsx: change the two together.
import { Link } from "react-router";
import { name as app } from "../../sebaro.product.json";
import { isPlaceholder, REPO_URL } from "./operator";
import { OperatorBlock, Out, PlaceholderField } from "./parts";

export function ImprintEn() {
  return (
    <>
      <h2>Information according to § 18(1) MStV (German Interstate Media Treaty)</h2>
      <OperatorBlock emailLabel="E-mail:" />
      <p>
        {app} is a private, non-commercial project. There is no VAT identification number, no entry in a register and no
        supervisory authority in charge. The information according to § 5 DDG is given as a precaution.
      </p>
      <h2>Reporting content</h2>
      <p>
        What stands on a wall is seen only by the people who have its link; the operator does not read along. Whoever
        wants to report content writes to the address above and names the link of the wall.
      </p>
      <h2>Privacy</h2>
      <p>
        Which data is processed when this page is opened and when a wall is used is described in the{" "}
        <Link to="/datenschutz">privacy notice</Link>.
      </p>
      <h2>Source code and licence</h2>
      <p>
        {app} is free software under the GNU Affero General Public License v3.0 or later. The source code is on{" "}
        {isPlaceholder(REPO_URL) ? <PlaceholderField value={REPO_URL} /> : <Out href={REPO_URL}>GitHub</Out>}; the
        source code of the version running here is linked in the footer. The software is provided without warranty.
      </p>
    </>
  );
}
