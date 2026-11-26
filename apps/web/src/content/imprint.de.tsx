// imprint.de.tsx: the German imprint. From FokusBeam's, there from RetroBeam's (docs/HERKUNFT.md): the operator is
// the same person. Change
// it together with imprint.en.tsx.
import { Link } from "react-router";
import { name as app } from "../../sebaro.product.json";
import { isPlaceholder, REPO_URL } from "./operator";
import { OperatorBlock, Out, PlaceholderField } from "./parts";

export function ImprintDe() {
  return (
    <>
      <h2>Angaben gemäß § 18 Abs. 1 MStV</h2>
      <OperatorBlock emailLabel="E-Mail:" />
      <p>
        {app} ist ein privates, nicht gewerbliches Projekt. Es gibt keine Umsatzsteuer-Identifikationsnummer, keine
        Registereintragung und keine zuständige Aufsichtsbehörde. Die Angaben nach § 5 DDG werden vorsorglich gemacht.
      </p>
      <h2>Inhalte melden</h2>
      <p>
        Was auf einer Wand steht, sehen nur die Personen, die ihren Link haben; der Betreiber liest es nicht mit. Wer
        einen Inhalt melden möchte, schreibt an die Adresse oben und nennt den Link der Wand.
      </p>
      <h2>Datenschutz</h2>
      <p>
        Welche Daten beim Aufruf dieser Seite und bei der Nutzung einer Wand verarbeitet werden, steht in der{" "}
        <Link to="/datenschutz">Datenschutzerklärung</Link>.
      </p>
      <h2>Quelltext und Lizenz</h2>
      <p>
        {app} ist freie Software unter der GNU Affero General Public License v3.0 oder später. Der Quelltext liegt auf{" "}
        {isPlaceholder(REPO_URL) ? <PlaceholderField value={REPO_URL} /> : <Out href={REPO_URL}>GitHub</Out>}; der
        Quelltext der hier laufenden Version ist in der Fußzeile verlinkt. Die Software wird ohne Gewährleistung
        bereitgestellt.
      </p>
    </>
  );
}
