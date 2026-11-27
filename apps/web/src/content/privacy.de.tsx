// privacy.de.tsx: the German privacy notice. Adapted from FokusBeam's notice, there from RetroBeam's
// (docs/HERKUNFT.md): its structure and the passages on the controller, hosting, logs, browser storage, rights and
// other matters follow it; what it says about walls is this product's, checked against the implementation: stage 1 (a
// wall's question and the people on it), stage 2 (notes, groups, where the notes lie, the surface and the list, no
// names on notes, the day's count of walls) and stage 3 (hidden writing, revealing, the clock, the brake per wall, no
// writer on any frame), state 68a1204, stage 4a (arranging by Workers AI on the server: what goes to it, the
// proposal, apply and undo, the counter of the AI over 24 hours, renaming locks), state c63573e, recipe 588552c,
// counter a0796b5, and stage 4b (the moderation's own key: what its browser sends to the one provider it chose, what
// stays in the tab, the three providers' own statements), section 3.5, state 60284aa, and stage 5, step A („Als
// Markdown sichern“ through the Worker with the session key, sections 2.1, 3.1, 4 and 7; the QR code drawn in the
// browser, section 3.6), state d3cc22a, read again end to end against the code on 2026-11-25. Stage M1 of the methods
// (PLAN-METHODEN.md): the wall's method with its steps and the step it stands in, section 3.1; stage M2: the hidden
// vote, its ballots per person and its result, sections 3.1 and 3.3; stage M3: estimates as ballots with a number,
// the unit of a method that estimates, the summary of a round, sections 3.1 and 3.3. Arranging in the
// browser (4c) is not built: section 3.4 names it as a plan. Who is responsible for a run with a key of one's own
// (section 3.5, „Wer verantwortlich ist“, and section 6) is the operator's understanding and an open point for a legal
// review. It is a draft until the operator has read it (operator.ts, NOTICE_REVIEWED), and no lawyer has reviewed it.
// Change it together with privacy.en.tsx, and whenever what the app stores or sends changes.
import { Link } from "react-router";
import { name as app } from "../../sebaro.product.json";
import { CLOUDFLARE_SETTINGS_CHECKED, isPlaceholder, REPO_URL } from "./operator";
import { OperatorBlock, OperatorEmail, Out, PlaceholderField } from "./parts";

export function PrivacyDe() {
  return (
    <>
      <p>
        {app} ist ein kostenloses, nicht-kommerzielles Hobbyprojekt einer Privatperson. Es gibt keine Konten, keine
        Werbung und keine Analyse-Werkzeuge; die Anwendung setzt keine Cookies. Diese Erklärung beschreibt trotzdem
        vollständig, welche Daten beim Aufruf dieser Anwendung und bei der Nutzung einer Wand verarbeitet werden, wo das
        geschieht, wie lange, und welche Rechte Sie haben.
      </p>

      <h2>1. Verantwortlicher</h2>
      <p>Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</p>
      <OperatorBlock emailLabel="E-Mail:" />
      <p>
        Es gibt keinen Datenschutzbeauftragten; eine Benennungspflicht besteht für dieses private, nicht-kommerzielle
        Angebot nicht.
      </p>

      <h2>2. Hosting und technischer Betrieb</h2>
      <h3>2.1 Cloudflare</h3>
      <p>
        Die Anwendung läuft auf der Plattform von <strong>Cloudflare, Inc.</strong>, 101 Townsend St, San Francisco, CA
        94107, USA, in den Produkten „Cloudflare Workers“ (Anwendungscode und die Dateien der Oberfläche) und „Durable
        Objects“ (Speicherung der Wände). Die Daten einer Wand werden in einem Durable Object mit der Zuständigkeit „EU“
        (Cloudflare-Jurisdiction <em>eu</em>) gespeichert, das heißt: Die dauerhafte Speicherung und die Logik einer
        Wand sind auf Rechenzentren in der Europäischen Union festgelegt. Der vorgeschaltete Worker läuft am jeweils
        nächstgelegenen Cloudflare-Standort, auch außerhalb der EU, und verarbeitet Inhalte dort flüchtig: wenn er die
        Frage einer Wand beim Anlegen entgegennimmt, wenn er die Frage einer Wand für die Ansicht „Beitreten“ abfragt,
        wenn er die Verbindung zu einer Wand weiterleitet, wenn er die Datei für „Als Markdown sichern“ von der Wand an
        Ihren Browser weitergibt (Abschnitt 3.1) und wenn er beim Ordnen die Zettel an den KI-Dienst gibt und den
        Vorschlag an die Moderation zurück (Abschnitt 3.4). Gespeichert wird dort nichts.
      </p>
      <p>Zwei Einschränkungen dazu, offen benannt:</p>
      <ul>
        <li>
          Die verschlüsselte Verbindung (TLS) endet am jeweils nächstgelegenen Cloudflare-Rechenzentrum. Eine
          vollständige Netzwerk-Residenz in der EU ist bei Cloudflare ein Unternehmensprodukt, das dieses Hobbyprojekt
          nicht nutzt. Ihre Anfragen werden also möglicherweise an einem Standort außerhalb der EU entgegengenommen und,
          wie oben beschrieben, flüchtig verarbeitet, bevor sie das Durable Object in der EU erreichen.
        </li>
        <li>
          Cloudflare ist ein US-Unternehmen und unterliegt unabhängig vom Speicherort dem US CLOUD Act. Ausgleichend
          gelten das EU-US Data Privacy Framework (Cloudflare ist zertifiziert) und die Standardvertragsklauseln der
          EU-Kommission; hinzu kommt, dass die Daten auf das Nötigste beschränkt und kurzlebig sind.
        </li>
      </ul>
      <p>
        Cloudflare verarbeitet als Betreiber seines Netzes eigene technische Daten zu jeder Anfrage (u. a. IP-Adresse,
        aufgerufene Adresse, Zeitpunkt, Browser-Kennung), um das Netz zu betreiben, vor Angriffen zu schützen und Fehler
        zu erkennen. Diese Verarbeitung findet in Cloudflares eigenen Systemen statt; Einzelheiten stehen in der{" "}
        <Out href="https://www.cloudflare.com/privacypolicy/">Datenschutzerklärung von Cloudflare</Out>. Ein Vertrag zur
        Auftragsverarbeitung mit Cloudflare besteht über Cloudflares Standard-Datenverarbeitungszusatz.
      </p>
      <p>
        Rechtsgrundlage für das Hosting: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren, kostenlosen und
        stabilen Betrieb des Angebots).
      </p>

      <h3>2.2 Was die Anwendung selbst protokolliert, und was nicht</h3>
      <ul>
        <li>
          Die Anwendung schreibt <strong>keine Zugriffsprotokolle</strong>. Cloudflares „Invocation Logs“, die die
          vollständige Adresse jeder Anfrage für einige Tage aufbewahren würden, sind für diese Anwendung ausdrücklich
          abgeschaltet. Das ist Absicht: Die Adresse einer Wand ist zugleich der Schlüssel zu ihr (Abschnitt 3.6).
        </li>
        <li>
          Die Anwendung gibt selbst keine Protokollzeilen aus. Bricht ein Aufruf mit einem unerwarteten Fehler ab, hält
          Cloudflare die technische Fehlermeldung in seinen Worker-Logs fest; dort gelten Cloudflares
          Aufbewahrungsfristen. Die Anwendung ist so gebaut, dass solche Meldungen keine Namen, Fragen oder Texte von
          Zetteln enthalten; für Fehlermeldungen der Plattform selbst lässt sich das nicht vollständig zusichern.
        </li>
        <li>
          Die Anwendung <strong>speichert keine IP-Adressen</strong>. Eine Ausnahme muss ehrlich genannt werden: Um zu
          verhindern, dass ein Skript in kurzer Zeit tausende Wände anlegt und damit das kostenlose Kontingent für alle
          aufbraucht, wird beim <strong>Anlegen einer Wand</strong> die IP-Adresse des Anfragenden als Zählschlüssel
          verwendet. Dieser Zähler lebt ausschließlich im Arbeitsspeicher eines einzelnen Durable Objects, wird nie auf
          einen Datenträger geschrieben, ist nicht an die EU gebunden (er enthält keine Daten aus Wänden) und wird
          spätestens wenige Minuten nach der letzten Anfrage verworfen: Er ist 60 Sekunden nach der letzten Anfrage
          wieder „voll“ und wird bei der nächsten Bereinigung gelöscht; bleibt jede weitere Anfrage aus, entfernt
          Cloudflare das untätige Durable Object samt Zählern aus dem Arbeitsspeicher. Die Obergrenze von wenigen
          Minuten beruht auf dem dokumentierten Verhalten der Plattform, nicht auf einer vertraglichen Zusage.
          Zusätzlich läuft vorgeschaltet Cloudflares eigene Rate-Limiting-Funktion mit demselben IP-Schlüssel; deren
          flüchtige Zähler verwaltet Cloudflare.
        </li>
        <li>
          Dasselbe Durable Object speichert dauerhaft eine einzige Zeile: einen Tag (nach koordinierter Weltzeit, UTC)
          und die Zahl der Wände, die an diesem Tag angelegt wurden; die erste Wand eines neuen Tages überschreibt sie.
          Mit ihr begrenzt die Anwendung die Wände pro Tag, damit das kostenlose Kontingent reicht: Ist die Grenze
          erreicht, legt sie bis 00:00 Uhr UTC keine neue Wand an; bestehende Wände laufen weiter. Die Zeile sagt nichts
          über Personen, Wände oder IP-Adressen.
        </li>
        <li>
          Seit es das Ordnen mit KI gibt, speichert dasselbe Durable Object eine zweite Zeile: die Rechenzeit, die das
          Ordnen in den letzten 24 Stunden verbraucht hat, und wann jede Wand in dieser Zeit geordnet wurde, unter einem
          aus ihrer Adresse berechneten Schlüssel statt unter der Adresse (Abschnitt 3.4).
        </li>
      </ul>
      <p>
        Rechtsgrundlage für die Missbrauchsbremse und das Tagesbudget: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
        Interesse, das kostenlose Angebot vor Überlastung zu schützen).
      </p>

      <h2>3. Was verarbeitet wird, wenn Sie eine Wand nutzen</h2>
      <h3>3.1 Die Daten</h3>
      <ul>
        <li>
          <strong>Die Wand:</strong> ihre Frage (höchstens 140 Zeichen), der Zeitpunkt des Anlegens, der Tag ihrer
          automatischen Löschung, ein zufälliger Moderationsschlüssel, die gewählte Methode mit ihren Schritten (eine
          Kopie aus dem Katalog der Anwendung, beim Anlegen gespeichert; bei einer Methode, die schätzt, mit der
          Einheit, die die Moderation dafür angegeben hat), in welchem Schritt die Wand steht und wie weit sie schon war
          (daraus folgt, ob verdeckt geschrieben wird oder die Zettel aufgedeckt sind), die Uhr des Schritts (wann sie
          abläuft oder wie viel Zeit angehalten noch bleibt, und wie oft sie gestellt wurde) und für die Bremse der Wand
          (unten) ein Tag nach UTC mit der Nummer der ersten Änderung an diesem Tag. Diese Angaben sagen nichts über
          Personen.
        </li>
        <li>
          <strong>Je Person:</strong> der Anzeigename (ein Vorname oder ein Pseudonym genügt, höchstens 40 Zeichen), ob
          die Person moderiert, der Zeitpunkt des ersten Beitritts, eine zufällige Kennung, die die Wand der Person
          gibt, und ein zufälliger Sitzungsschlüssel, den Ihr Browser erzeugt und mit dem er Sie beim Wiederkommen als
          dieselbe Person ausweist.
        </li>
        <li>
          <strong>Zettel:</strong> bis zu 500 je Wand, jeweils der Text (höchstens 300 Zeichen), die Kennung der Person,
          die ihn geschrieben hat, der Ort auf der Fläche (wo der Zettel angelegt wurde und wo er jetzt liegt), die
          Gruppe, zu der er gehört, und die Zeitpunkte, zu denen er angelegt und sein Text zuletzt geändert wurde. Wer
          einen Zettel verschoben hat, wird nicht gespeichert.
        </li>
        <li>
          <strong>Gruppen:</strong> bis zu 80 je Wand, jeweils der Titel (höchstens 60 Zeichen, er darf fehlen), Ort und
          Größe des Rahmens, die Stelle in der Reihenfolge der Gruppen und zwei Angaben für das Ordnen (Abschnitt 3.4):
          ob der Titel von einer Person oder von der KI stammt und ob das Ordnen die Gruppe unberührt lässt. Wer eine
          Gruppe angelegt oder geändert hat, wird nicht gespeichert.
        </li>
        <li>
          <strong>Stimmen:</strong> in einem Schritt, in dem gewählt wird, je Person ein Stimmzettel: welche Optionen
          (Gruppen oder Zettel) sie wie viele Punkte gibt, die Kennung der Person und die laufende Nummer der Änderung.
          Wer neu abgibt, überschreibt den eigenen Stimmzettel. Beim Auszählen speichert die Wand das Ergebnis: je
          Option ihren Titel oder Text, ihre Punkte, ihren Platz und wie viele Stimmzettel ihr etwas gaben, dazu die
          Zahl der Stimmzettel, ohne Kennungen. Was zur Wahl steht, hält die Wand beim Beginn des Schritts fest.
        </li>
        <li>
          <strong>Schätzungen:</strong> in einem Schritt, in dem geschätzt wird, je Person eine Zahl, wie ein
          Stimmzettel: die Zahl, die Kennung der Person und die laufende Nummer der Änderung. Wer neu abgibt,
          überschreibt die eigene Zahl. Beim Auszählen speichert die Wand nur die Zusammenfassung der Runde: wie viele
          geschätzt haben, den Median, die Grenzen der mittleren Hälfte, die kleinste und die größte Zahl, ohne
          Kennungen. Die kurze Begründung neben einer Schätzung ist ein Zettel wie jeder andere (oben): verdeckt, bis
          der nächste Schritt sie für alle zeigt, ohne Namen.
        </li>
      </ul>
      <p>
        Zu jedem Zettel, zu jeder Gruppe und zur Lage der Zettel hält die Wand außerdem die laufende Nummer der letzten
        Änderung fest, nach einem Ordnen auch den Stand davor (Abschnitt 3.4). Nicht gespeichert wird, wer gerade
        verbunden ist: „da“ und „nicht da“ liest die Anwendung aus den offenen Verbindungen.
      </p>
      <p>
        <strong>Verdeckt schreiben, dann aufdecken.</strong> Wer eine Wand anlegt, wählt, ob verdeckt geschrieben wird;
        voreingestellt ist es so. Solange verdeckt geschrieben wird, sendet der Server die Zettel einer Person nur an
        den Browser dieser Person. Alle anderen, auch die Moderation, bekommen von fremden Zetteln nur eine Zahl: wie
        viele es sind. Das Aufdecken ist Sache der Moderation, fragt vorher und lässt sich nicht zurücknehmen; danach
        sehen alle alle Zettel. Die Uhr der Schreibphase stellt nur die Moderation; alle sehen die Restzeit. Läuft sie
        ab, geschieht nichts von selbst.
      </p>
      <p>
        <strong>Verdeckt wählen.</strong> Gewählt wird im eigenen Browser; erst „Abgeben“ sendet den Stimmzettel an den
        Server. Der Server sendet einen Stimmzettel nur an den Browser der Person, die ihn abgegeben hat. Alle anderen,
        auch die Moderation, bekommen bis zum Auszählen nur eine Zahl: wie viele abgegeben haben. Einzelne Stimmzettel
        sieht niemand, auch nach dem Auszählen nicht: Das Auszählen ist Sache der Moderation, und dann bekommen alle
        zugleich nur das Ergebnis. Auch die Datei von „Als Markdown sichern“ enthält nur das Ergebnis. Für Schätzungen
        gilt dasselbe: Das Ergebnis ist die Zusammenfassung der Runde. Die kleinste und die größte Zahl stehen darin;
        wer sie geschätzt hat, nicht. In einer kleinen Gruppe lässt sich aus ihnen dennoch mehr erraten als aus einem
        Median.
      </p>
      <p>
        <strong>Wer was tun kann.</strong> Jede Person, die der Wand beigetreten ist, kann Zettel schreiben. Solange
        verdeckt geschrieben wird, ändert, verschiebt und löscht jede Person nur ihre eigenen Zettel, die Moderation
        eingeschlossen, und Gruppen gibt es noch nicht. Nach dem Aufdecken kann jede Person jeden Zettel verschieben und
        Gruppen anlegen, benennen, verschieben, in der Größe ändern und löschen, auf der Fläche wie in der Liste; den
        Text eines Zettels ändert weiter nur, wer ihn geschrieben hat, löschen kann ihn diese Person oder die
        Moderation.
      </p>
      <p>
        <strong>Alle auf der Wand sehen</strong> die Frage, die Namen, wer moderiert und wer gerade da ist, nach dem
        Aufdecken alle Zettel mit ihrem Text und alle Gruppen mit ihrem Titel, vorher die eigenen Zettel und die Zahl
        der anderen.{" "}
        <strong>Wer einen Zettel geschrieben hat, zeigt die Anwendung niemandem und sendet es an keinen Browser</strong>
        , in keiner Phase: Der Server speichert die Kennung der schreibenden Person beim Zettel, sendet sie aber nicht.
        Jeder Browser erfährt nur, ob ein Zettel der eigene ist; dort steht für die Person, die ihn geschrieben hat, das
        Wort „Deiner“. Anonym ist ein Zettel damit nicht in jedem Fall: Jeder Zettel trägt die Zeitpunkte, zu denen er
        geschrieben und geändert wurde, und alle sehen, wer gerade da ist und wann die Zahl der Zettel steigt. In einer
        kleinen Gruppe lässt sich daraus erraten, wer etwas geschrieben hat.
      </p>
      <p>
        <strong>Als Markdown sichern.</strong> Jede Person auf der Wand kann sie über „Als Markdown sichern“ als Datei
        auf ihr Gerät holen. Der Server stellt die Datei erst auf diese Anfrage zusammen, aus genau dem, was die Person
        auf der Wand sehen darf: die Frage, die Gruppen mit ihren Titeln, die Texte der Zettel und das Ergebnis einer
        ausgezählten Wahl oder Schätzung, nie einen Stimmzettel und nie eine einzelne Schätzung; solange verdeckt
        geschrieben wird, nur ihre eigenen Zettel und die Zahl der anderen. Namen stehen nicht darin, auch nicht, wer
        einen Zettel geschrieben hat. Ihr Browser weist sich dabei mit seinem Sitzungsschlüssel aus (Abschnitt 4). Der
        Server speichert zu dieser Anfrage nichts und merkt sich die Datei nicht; die Datei liegt danach nur auf Ihrem
        Gerät, und was mit ihr geschieht, entscheiden Sie.
      </p>
      <p>
        <strong>Die Bremse der Wand.</strong> Eine Wand speichert höchstens 1.500 Änderungen an einem Tag nach UTC
        (Zettel schreiben, ändern, verschieben, löschen, Gruppen, Stimmzettel). Danach nimmt sie bis 00:00 Uhr UTC keine
        weitere Änderung an; Beitreten, die Schritte mit dem Aufdecken, das Auszählen, die Uhr und das Löschen der Wand
        gehen weiter. Sie zählt dafür die Nummern der Änderungen, nicht Personen. Zweck und Rechtsgrundlage sind
        dieselben wie beim Tagesbudget (Abschnitt 2.2).
      </p>
      <p>
        Die Frage, der Anzeigename, die Texte der Zettel und die Titel der Gruppen sind freier Text: Schreiben Sie
        nichts hinein, was nicht alle auf der Wand lesen sollen, und keine Angaben über Gesundheit oder andere besonders
        schützenswerte Dinge. Der Betreiber wertet nichts davon aus; die Anwendung enthält keine Auswertung je Person
        und, von den zwei Zählern abgesehen (Wände eines Tages, Abschnitt 2.2; Ordnen der letzten 24 Stunden, Abschnitt
        3.4), keine Statistik über mehrere Wände. Was beim Ordnen an einen KI-Dienst geht, steht in Abschnitt 3.4, mit
        einem eigenen Schlüssel der Moderation in Abschnitt 3.5.
      </p>

      <h3>3.2 Wo</h3>
      <p>
        Im Durable Object der Wand, in Rechenzentren in der Europäischen Union (Abschnitt 2.1). Jede Wand hat ihr
        eigenes; es gibt kein Verzeichnis der Wände.
      </p>

      <h3>3.3 Wie lange</h3>
      <ul>
        <li>
          Eine Wand löscht sich <strong>30 Tage nach dem letzten Beitritt einer Person automatisch</strong>. Als
          Beitritt zählt auch das Wiederkommen und jede automatische Neuverbindung. Die Frist rückt höchstens einmal am
          Tag weiter; die Löschung liegt deshalb 29 bis 30 Tage nach dem letzten Beitritt. Tritt niemand bei, löscht
          sich die Wand 30 Tage nach dem Anlegen. Die Anwendung löscht dabei den gesamten Speicher der Wand, mit allen
          Zetteln, Gruppen, Stimmzetteln und Ergebnissen. Bis dahin bleiben die Stimmzettel je Person gespeichert. Der
          Link führt danach zu „Unbekannte Wand“, wie bei einer Wand, die es nie gab.
        </li>
        <li>
          Die Moderation kann die Wand <strong>jederzeit löschen</strong> („Wand löschen“): sofort und vollständig, mit
          allen Zetteln und Gruppen.
        </li>
        <li>
          <strong>Nur die eigenen Angaben</strong> löscht jede Person über „Meine Angaben löschen“ im Menü „Mehr“ der
          Wand, nach einer Rückfrage: Der Server entfernt dann sofort ihren Anzeigenamen, ihre Rolle, ihre Kennung und
          ihren Sitzungsschlüssel, und ihr Browser entfernt die Wand aus seiner Liste, mit dem Moderationsschlüssel,
          falls er einen hielt. Die Zettel der Person bleiben auf der Wand, ohne Namen: Sie tragen weiter die bisherige
          Kennung, die dann keinem Anzeigenamen mehr zugeordnet ist, und gehören niemandem mehr. Ändern kann sie danach
          niemand. Ebenso bleiben ihre Stimmzettel unter dieser Kennung gespeichert und zählen beim Auszählen mit.
          Solange verdeckt geschrieben wird, bleiben sie verdeckt, und niemand kann sie löschen, auch die Moderation
          nicht; nach dem Aufdecken kann die Moderation sie löschen. Wer seine Zettel nicht auf der Wand lassen will,
          löscht sie vorher.
        </li>
        <li>
          Einen <strong>einzelnen Zettel</strong> löscht der Server auf den Befehl der Person, die ihn geschrieben hat,
          oder, nach dem Aufdecken, der Moderation: Er entfernt dann den Zettel und seinen Ort. Wird eine Gruppe
          gelöscht, bleiben ihre Zettel ohne Gruppe liegen. Man löscht einen Zettel auf der Fläche oder in der Liste
          über „Löschen“, eine Gruppe dort über „Gruppe löschen“; eine Gruppe kann jede Person auf der Wand löschen.
        </li>
        <li>
          Für alle Löschwege gilt: Cloudflare hält für SQLite-gestützte Durable Objects plattformseitig eine
          Wiederherstellungshistorie vor, laut Cloudflares Dokumentation bis zu 30 Tage, aus der nur der Betreiber über
          eine Programmierschnittstelle wiederherstellen könnte. Die Anwendung nutzt diese Funktion nicht; eine
          Abschaltmöglichkeit ist nicht dokumentiert. Erst nach Ablauf dieser Frist sind gelöschte Daten auch
          plattformseitig verschwunden.
        </li>
      </ul>

      <h3 id="ordnen">3.4 Das Ordnen mit KI</h3>
      <p>
        <strong>Wer es auslöst.</strong> Nur die Moderation, über „Ordnen“, und erst nach dem Aufdecken. Höchstens
        sechsmal je Wand in 24 Stunden; dazu hat die ganze Anwendung eine Menge an Rechenzeit für 24 Stunden, und ist
        sie verbraucht, ordnet keine Wand mehr mit KI, bis genug davon älter als 24 Stunden ist. Auch Cloudflare selbst
        kann ablehnen, wenn das kostenlose Kontingent des Kontos aufgebraucht ist; die Anwendung sagt das dann, kann
        aber keine Uhrzeit nennen, und der Lauf schickt keine weitere Anfrage. Von Hand ordnen geht immer. Hat die
        Moderation einen eigenen KI-Schlüssel eingetragen, ordnet nicht Cloudflare: Für diesen Weg gilt Abschnitt 3.5
        statt dieses Abschnitts.
      </p>
      <p>
        <strong>Was an den KI-Dienst geht.</strong> Der Worker (Abschnitt 2.1) liest die Zettel aus der Wand und sendet
        an „Cloudflare Workers AI“, einen KI-Dienst von Cloudflare, die Frage der Wand und den Text aller Zettel, die in
        keiner Gruppe liegen, die eine Person von Hand angelegt oder umbenannt hat (unten, „Ohne KI“), dazu die Sprache,
        in der die Überschriften geschrieben werden sollen. Das geschieht in mehreren Anfragen: einmal alle diese Zettel
        zusammen, danach in Stapeln zu 50. Antwortet der Dienst auf eine Anfrage nicht nach wenigen Sekunden, geht
        dieselbe Anfrage ein zweites Mal daneben hinaus, und die erste lesbare Antwort zählt; eine Anfrage ohne
        brauchbare Antwort wird einmal wiederholt. Dieselben Texte können so bis zu viermal an den Dienst gehen.
        Gerechnet wird mit einem Sprachmodell, das Cloudflare in diesem Dienst anbietet (derzeit „Gemma“ von Google);
        welches, ist eine Einstellung der Anwendung und kann wechseln. <strong>Nicht mit geht</strong>, wer einen Zettel
        geschrieben hat, kein Name, keine Kennung eines Zettels oder einer Person, nicht, wo ein Zettel liegt, und nicht
        die Adresse der Wand: Im Text an das Modell sind die Zettel nur durchnummeriert. Ein Zettel kann aber selbst
        etwas über Personen sagen; was darin steht, geht mit (Abschnitt 3.1, freier Text).
      </p>
      <p>
        <strong>Wo, und was Cloudflare damit tut.</strong> Wo Workers AI rechnet, lässt sich nicht auf die EU festlegen:
        Die Texte können außerhalb der EU verarbeitet werden. Nach Cloudflares Angaben trainiert Cloudflare mit den
        Inhalten, die Workers AI verarbeitet, keine KI-Modelle und behält Eingaben und Antworten nicht länger, als nötig
        ist, um die Anfrage zu beantworten.
      </p>
      <p>
        <strong>Was danach gespeichert wird.</strong> Der Vorschlag (Gruppen mit Überschrift und welcher Zettel wohin
        gehört) geht nur an den Browser der Moderation und wird nirgends gespeichert. Erst wenn die Moderation
        „Anwenden“ wählt, speichert die Wand die Gruppen und die neuen Orte der Zettel wie jede andere Änderung, im
        Durable Object in der EU; alle auf der Wand sehen sie dann. Dazu merkt sich die Wand in einer Zeile den Stand
        vor dem letzten Ordnen, für „Rückgängig“: wo jeder verschobene Zettel vorher lag und in welcher Gruppe, welche
        Gruppen hinzukamen und welche, mit ihrem Titel, wegfielen. Diese Zeile verschwindet beim Rückgängigmachen, das
        nächste Ordnen überschreibt sie, sonst geht sie mit der Wand. „Rückgängig“ lässt eine Gruppe, die eine Person
        inzwischen umbenannt hat, mit ihren Zetteln stehen.
      </p>
      <p>
        <strong>Der Zähler.</strong> Für die Grenzen oben speichert die Anwendung eine Zeile für die letzten 24 Stunden:
        die verbrauchte oder für einen laufenden Lauf vorgemerkte Rechenzeit (in Cloudflares Einheit „Neuronen“), in
        Abschnitten von zehn Minuten, und je Wand den Zeitpunkt jedes gezählten Laufs, auf die Millisekunde, höchstens
        sechs. Ein Lauf ohne Vorschlag wird wieder herausgenommen. Die Wand steht darin nicht unter ihrer Adresse,
        sondern unter einem Schlüssel, der aus ihr berechnet wird (die ersten 8 Bytes eines SHA-256-Hashs): Wer die
        Adresse kennt, kann ihn berechnen, aus dem Schlüssel aber nicht die Adresse. Zetteltexte, Namen und IP-Adressen
        stehen nicht darin. Die Zeile liegt im selben Durable Object wie der Zähler der Wände, nicht an die EU gebunden
        (Abschnitt 2.2). Einträge, die älter als 24 Stunden sind, entfernt die Anwendung, wenn sie die Zeile das nächste
        Mal schreibt, also beim nächsten Lauf irgendeiner Wand; bis dahin bleiben sie stehen.
      </p>
      <p>
        <strong>Ohne KI.</strong> Wer nicht will, dass die Zettel an den KI-Dienst gehen, ordnet von Hand: Eine Gruppe,
        die eine Person anlegt, lässt das Ordnen samt ihren Zetteln unberührt, und diese Zettel gehen nie an den
        KI-Dienst. Ebenso eine Gruppe der KI, sobald eine Person sie umbenennt: Ab dann gehen ihre Zettel in späteren
        Läufen nicht mehr hinaus; im Lauf, der die Gruppe angelegt hat, gingen sie hinaus. Das gilt für Umbenennungen ab
        dem 23. November 2026; eine Gruppe, die früher umbenannt wurde, erst, wenn sie erneut umbenannt wird. Noch nicht
        gebaut und weiter nur geplant ist das Ordnen im Browser; kommt es, wird dieser Abschnitt ergänzt.
        Rechtsgrundlage wie in Abschnitt 3.7: Das Ordnen ist eine Funktion der Wand, die die Moderation auslöst.
      </p>

      <h3 id="eigener-ki-schluessel">3.5 Ordnen mit eigenem KI-Schlüssel</h3>
      <p>
        <strong>Wann.</strong> Nur wenn die Moderation unter „Mehr“ einen eigenen Schlüssel für einen KI-Anbieter
        eingetragen hat („Eigener KI-Schlüssel“). Dann fragt „Ordnen“ diesen Anbieter statt Cloudflare; alles andere an
        der Wand bleibt, wie es ist. Derzeit bietet die Anwendung niemandem einen Anbieter an: Sie tut das erst, wenn
        gemessen ist, wie gut das Modell des Anbieters ordnet, und das ist noch für keinen geschehen. Ein Tab zeigt die
        Anbieter trotzdem, wenn die Adresse den Zusatz <code>#eigener-schluessel</code> trägt; die Anwendung nimmt ihn
        sofort aus der Adresse, und nach dem Neuladen gilt er nicht mehr. Der Weg ist hier schon beschrieben.
      </p>
      <p>
        <strong>Wohin.</strong> An genau einen Empfänger, den die Moderation gewählt hat: Mistral AI (
        <code>api.eu.mistral.ai</code>), OpenAI (<code>api.openai.com</code>) oder Anthropic (
        <code>api.anthropic.com</code>). Der Browser der Moderation sendet unmittelbar dorthin, nicht über den Server
        von {app}. Code lädt die Anwendung von dort nicht; ihre Sicherheitsrichtlinie (Content-Security-Policy) erlaubt
        dem Browser außer der Anwendung selbst genau diese drei Adressen. Den Programmteil für diesen Weg holt der
        Browser beim ersten Lauf von der Anwendung selbst; diese Anfrage trägt nichts von der Wand.
      </p>
      <p>
        <strong>Welche Anfragen.</strong> Vorab fragt der Browser von sich aus beim Anbieter an, ob er Anfragen dieser
        Anwendung annimmt (ein „Preflight“, ohne Schlüssel und ohne Inhalt). Dann geht je Lauf eine Anfrage mit allen
        Zetteln hinaus, danach eine je 50 Zettel, diese nebeneinander. Hat der Anbieter auf eine Anfrage nach 15
        Sekunden (die erste) oder 12 Sekunden (die übrigen) nicht geantwortet, geht dieselbe Anfrage ein zweites Mal
        daneben hinaus, und die erste lesbare Antwort zählt; eine Anfrage ohne brauchbare Antwort wird einmal
        wiederholt. Dieselben Texte können so bis zu viermal an den Anbieter gehen. Lehnt der Anbieter den Schlüssel,
        das Konto oder die Anfrage selbst ab, stellt der Lauf keine weitere Anfrage.
      </p>
      <p>
        <strong>Was jede Anfrage enthält.</strong> Den Schlüssel (in der Kopfzeile <code>Authorization</code>), den
        Namen des Modells, feste Anweisungen auf Englisch (darin die Sprache, in der die Überschriften geschrieben
        werden sollen), die Frage der Wand und die Texte der aufgedeckten Zettel, die in keiner Gruppe liegen, die eine
        Person angelegt oder umbenannt hat (Abschnitt 3.4, „Ohne KI“): je Zettel eine nummerierte Zeile, in der
        Reihenfolge, in der sie geschrieben wurden. Die Anfragen, die die Zettel den Themen zuordnen, tragen dazu die
        Themen, die der Anbieter in der ersten Antwort genannt hat. Außerdem gehen das Schema der erwarteten Antwort und
        technische Angaben mit (etwa, wie lang die Antwort höchstens sein darf). Wie jeder Anfrage fügt der Browser
        hinzu: die IP-Adresse des Geräts, <code>Origin</code> (die Adresse der Anwendung, nicht die der Wand), die
        Kennung des Browsers (User-Agent), die bevorzugten Sprachen (Accept-Language) und, je nach Browser, weitere
        Angaben über Browser und Gerät (Client Hints). Ein Referer und Cookies gehen nicht mit. Nur bei Anthropic kommen
        Kopfzeilen der Programmbibliothek von Anthropic hinzu, die unter anderem Name und Version des Browsers nennen.
      </p>
      <p>
        <strong>Nicht mit geht</strong>, wer einen Zettel geschrieben hat, kein Name, keine Kennung eines Zettels oder
        einer Person, nicht, wo ein Zettel liegt, keine Gruppe, nicht die Adresse oder Kennung der Wand, weder der
        Moderationsschlüssel noch ein Sitzungsschlüssel. Was in einem Zettel selbst steht, geht mit (Abschnitt 3.1,
        freier Text).
      </p>
      <p>
        <strong>Was der Server von {app} davon erfährt.</strong> Vom Ordnen selbst nichts: Er wird nicht gefragt, und es
        zählt weder als einer der Läufe der Wand noch als Rechenzeit (Abschnitt 3.4). Erst wenn die Moderation
        „Anwenden“ wählt, sendet ihr Browser wie sonst die Gruppen mit ihren Überschriften und die neuen Orte der
        Zettel, dazu die Angabe, dass ein eigener Schlüssel den Vorschlag geliefert hat (<code>source: "key"</code>).
        Der Server gibt diese Angabe an jeden Browser auf der Wand weiter und speichert sie nicht. Welcher Anbieter es
        war, erfährt weder der Server noch ein anderer Browser. Was danach auf der Wand gespeichert wird, steht in
        Abschnitt 3.4 („Was danach gespeichert wird“).
      </p>
      <p>
        <strong>Was im Browser bleibt.</strong> Nichts wird gespeichert, auch nicht im Speicher des Browsers (Abschnitt
        4). Schlüssel, gewählter Anbieter und der Zusatz aus der Adresse liegen nur im Arbeitsspeicher des Tabs;
        Neuladen oder Schließen des Tabs entfernt sie, „Schlüssel entfernen“ den Schlüssel. Der Schlüssel steht nie in
        einer Adresse, einem Protokoll oder einer Fehlermeldung, und er geht nie an den Server von {app}.
      </p>
      <p>
        <strong>Abbrechen.</strong> „Abbrechen“ beendet die offenen Anfragen, ebenso die Grenze von 120 Sekunden, nach
        der die Anwendung nicht weiter wartet. Was der Anbieter bis dahin gerechnet hat, kann er dem Konto der
        Moderation trotzdem berechnen.
      </p>
      <p>
        <strong>Die Seite für den Schlüssel.</strong> Den Link zur Seite des Anbieters, auf der man einen Schlüssel
        anlegt, öffnet die Anwendung erst auf einen Klick, in einem neuen Tab und ohne Referer.
      </p>
      <p>
        <strong>Was der Anbieter damit tut</strong>, nach seinen eigenen Angaben, gelesen am 23. November 2026;
        dieselben Angaben nennt die Anwendung, wenn man den Anbieter wählt:
      </p>
      <ul>
        <li>
          <strong>Mistral</strong> rechnet nach eigenen Angaben für die EU-Adresse, die die Anwendung anfragt, in
          Rechenzentren in Ländern der EU und der EFTA; Daten zur Steuerung des Dienstes können auch anderswo
          verarbeitet werden. Eingaben und Antworten behält Mistral bis zu 30 Tage, um Missbrauch zu erkennen, außer
          Mistral hat dem Konto eine Nutzung ohne Aufbewahrung („Zero Data Retention“) gewährt. Ob Mistral damit
          trainiert, hängt von einer Einstellung des Kontos ab; was bei bezahlter Nutzung gilt, solange niemand sie
          ändert, sagt Mistral nicht eindeutig. Einzelheiten:{" "}
          <Out href="https://legal.mistral.ai/terms/privacy-policy">Datenschutzerklärung von Mistral</Out>.
        </li>
        <li>
          <strong>OpenAI</strong> sagt keinen Ort zu. Protokolle zur Missbrauchserkennung, die Eingaben und Antworten
          enthalten können, behält OpenAI bis zu 30 Tage, länger, wenn das Gesetz es verlangt oder es nötig ist, um
          Schaden abzuwenden. Trainiert wird damit nicht, außer das Konto hat ausdrücklich zugestimmt. Einzelheiten:{" "}
          <Out href="https://developers.openai.com/api/docs/guides/your-data">
            Angaben von OpenAI zu den Daten der API
          </Out>
          .
        </li>
        <li>
          <strong>Anthropic</strong> sagt keinen Ort zu („any available geography“). Eingaben und Antworten löscht
          Anthropic innerhalb von 30 Tagen; Inhalte, die seine Prüfsysteme als Verstoß gegen seine Nutzungsrichtlinie
          markieren, behält es bis zu zwei Jahre. Standardmäßig trainiert Anthropic damit nicht. Lehnt das Modell, das
          die Anwendung derzeit fragt, eine Anfrage ab, stellt Anthropic sie selbst einem anderen seiner Modelle
          (Fallback). Konten mit „Zero Data Retention“ lässt Anthropic nicht aus einem Browser fragen; die Anwendung
          meldet dann, dass der Schlüssel abgelehnt wurde. Einzelheiten:{" "}
          <Out href="https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data">
            Angaben von Anthropic zur Speicherdauer
          </Out>
          .
        </li>
      </ul>
      <p>
        <strong>Wer verantwortlich ist.</strong> Die Moderation sendet die Zettel unter ihrem eigenen Vertrag mit dem
        Anbieter, über ihr eigenes Konto dort. Nach dem Verständnis des Betreibers handelt der Anbieter bei dieser
        Verarbeitung für die Moderation, nicht für den Betreiber: Der Betreiber hat mit diesen Anbietern keinen Vertrag,
        erhält von ihnen nichts und sieht nicht, was hin- und zurückgeht. Verantwortlich ist er für die Anwendung, die
        die Anfrage stellt, also dafür, was sie sendet und was nicht (oben). Rechtsgrundlage dafür wie in Abschnitt 3.7:
        Das Ordnen ist eine Funktion der Wand, die die Moderation auslöst.
      </p>

      <h3>3.6 Der Link ist der Schlüssel: bitte lesen</h3>
      <p>
        Eine Wand hat keine Zugangskontrolle außer ihrem Link: Die Adresse enthält eine zufällige, nicht erratbare
        Kennung, und <strong>wer den Link hat, kann der Wand beitreten und alles darauf lesen</strong>: die Frage, die
        Namen und, sobald aufgedeckt ist, alle Zettel und Gruppen, die der Server für die Wand gespeichert hat
        (Abschnitt 3.1). Wer beigetreten ist, kann nach den Regeln des Servers auch Zettel schreiben und, nach dem
        Aufdecken, jeden Zettel verschieben und Gruppen anlegen, ändern und löschen. Geben Sie den Link nur an Ihr Team
        weiter, posten Sie ihn nicht in offenen Kanälen, und bedenken Sie, dass er in Chat-Verläufen und
        Browser-Historien stehen bleibt. Die Anwendung sendet den Link ihrerseits nie an Dritte weiter und bittet
        Suchmaschinen, Wände nicht aufzunehmen. Den QR-Code des Links („QR-Code zeigen“ im Menü „Mehr“) zeichnet Ihr
        Browser selbst; der Link geht dafür an keinen Dienst. Der QR-Code enthält nur den Link der Wand, nie den
        Moderationsschlüssel.
      </p>
      <p>
        Wer eine Wand anlegt, besitzt zusätzlich einen Moderationsschlüssel, der in seinem Browser liegt (Abschnitt 4).
        Um die Wand von einem anderen Gerät aus zu moderieren, kann er einen Moderationslink kopieren, der diesen
        Schlüssel hinter dem <code>#</code> der Adresse trägt, einem Teil, den Browser nie an einen Server senden; die
        Anwendung speichert den Schlüssel und entfernt ihn aus der Adresszeile, sobald der Link geöffnet wird. Wer den
        Moderationslink hat, moderiert die Wand: Er kann sie löschen, und der Server löscht auf seinen Befehl auch
        einzelne Zettel anderer.
      </p>

      <h3>3.7 Rechtsgrundlage</h3>
      <p>
        Sie nutzen eine Wand, weil Sie oder Ihr Team sie angefordert haben; die Verarbeitung der oben genannten Daten
        ist genau das, was nötig ist, um diese Wand bereitzustellen. Rechtsgrundlage ist daher Art. 6 Abs. 1 lit. b
        DSGVO (Erfüllung eines unentgeltlichen Nutzungsverhältnisses, das durch das Anlegen bzw. Beitreten zustande
        kommt), ergänzend Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse, ein funktionierendes, missbrauchsarmes
        Angebot bereitzustellen). Für die Kernfunktion wird <strong>keine Einwilligung</strong> eingeholt und keine
        benötigt; es gibt deshalb auch keinen Zustimmungsdialog.
      </p>
      <p>
        Nutzen Sie {app} im Rahmen Ihrer Arbeit, ist Ihr Arbeitgeber gegebenenfalls selbst datenschutzrechtlich
        verantwortlich für die Entscheidung, das Werkzeug einzusetzen; das berührt diese Erklärung nicht.
      </p>

      <h2>4. Speicherung in Ihrem Browser: keine Cookies</h2>
      <p>
        Die Anwendung setzt <strong>keine Cookies</strong>, weder eigene noch fremde. Stattdessen legt sie wenige
        Einträge im Speicher Ihres Browsers ab (localStorage, einen im sessionStorage):
      </p>
      <ul>
        <li>
          <code>ideabeam-walls</code>: Ihr zuletzt verwendeter Anzeigename; die Wände, die Sie angelegt haben oder auf
          denen Sie waren, je mit Adresse, Frage der Wand, Ihrem Namen dort, Ihrem Sitzungsschlüssel und dem Zeitpunkt
          des letzten Besuchs; dazu, wenn Sie eine Wand moderieren, ihr Moderationsschlüssel. Ohne Konto ist das der
          einzige Rückweg auf eine Wand als dieselbe Person.
        </li>
        <li>
          <code>ideabeam-view</code>: ob eine Wand in diesem Browser als Fläche oder als Liste aufgeht. Der Eintrag
          entsteht erst, wenn Sie umschalten, und gilt dann für jede Wand in diesem Browser; ohne ihn entscheidet die
          Breite des Fensters.
        </li>
        <li>
          <code>sb-lang</code>, <code>sb-theme</code>, <code>sb-tone</code>, <code>sb-motion</code>: die Sprache und
          Ihre Wahl für Hell oder Dunkel, den Farbton und reduzierte Bewegung.
        </li>
        <li>
          <code>sb-started</code> (sessionStorage, endet mit dem Tab): dass der Startbildschirm in diesem Tab schon
          gezeigt wurde.
        </li>
      </ul>
      <p>
        Diese Einträge bleiben bestehen, bis Sie sie löschen: eine einzelne Wand unter „Meine Wände“ über „Aus der Liste
        entfernen“, alles über die Einstellungen Ihres Browsers (Website-Daten für die verwendete Adresse löschen). Den
        Eintrag einer Wand, die es nicht mehr gibt, entfernt die Anwendung selbst, sobald Sie deren Adresse öffnen,
        ebenso nach „Meine Angaben löschen“ (Abschnitt 3.3). Es werden keine Einträge zu Analyse-, Werbe- oder
        Tracking-Zwecken abgelegt. Der Browser hängt keinen dieser Einträge von sich aus an Anfragen an (anders als bei
        Cookies). Die Anwendung überträgt sie in zwei Fällen: Beim Beitritt zu einer Wand, und bei jeder automatischen
        Neuverbindung, etwa nach einer Netzunterbrechung, sendet sie Anzeigename, Sitzungsschlüssel und, falls
        vorhanden, den Moderationsschlüssel dieser Wand an diese Wand. Bei „Als Markdown sichern“ sendet sie den
        Sitzungsschlüssel dieser Wand an diese Wand (Abschnitt 3.1). Die Einträge zur Darstellung entstehen erst, wenn
        Sie die jeweilige Wahl treffen, und werden nie übertragen. Ein eigener KI-Schlüssel der Moderation steht in
        keinem dieser Einträge (Abschnitt 3.5).
      </p>
      <p>
        Das Speichern dieser Einträge ist nach § 25 Abs. 2 Nr. 2 TDDDG von der Einwilligungspflicht ausgenommen, weil es
        unbedingt erforderlich ist, um den von Ihnen ausdrücklich gewünschten Dienst bereitzustellen: Ihre Wand, Ihre
        Sitzung, Ihre Sprache und die von Ihnen gewählte Darstellung. Deshalb gibt es keinen Cookie-Banner.
      </p>

      <h2>5. Was es nicht gibt</h2>
      <ul>
        <li>keine Web-Analyse, keine Zählpixel, kein Fingerprinting;</li>
        <li>
          keine Schriftarten, Skripte oder Stylesheets von fremden Servern (alles wird von der Anwendung selbst
          ausgeliefert);
        </li>
        <li>keine Werbung, keine Werbenetzwerke;</li>
        <li>keine Kamera, kein Mikrofon, keine Benachrichtigungen;</li>
        <li>keine Profilbildung, keine automatisierten Entscheidungen im Sinne von Art. 22 DSGVO;</li>
        <li>
          keine Zusammenführung von Daten über mehrere Wände hinweg (der Betreiber weiß nicht, wer welche Wände nutzt).
        </li>
      </ul>
      <p>
        Der Quelltext von {app} ist unter der AGPL-3.0-or-later veröffentlicht; die Aussagen zur Anwendung selbst lassen
        sich dort nachprüfen
        {isPlaceholder(REPO_URL) ? (
          <>
            {" "}
            (<PlaceholderField value={REPO_URL} />)
          </>
        ) : (
          <>
            : <Out href={REPO_URL}>GitHub</Out>
          </>
        )}
        . Die Einstellungen des Cloudflare-Kontos (kein Web-Analytics-Beacon, keine Bot-Schutz-Cookies, keine
        Challenge-Seiten) sind nicht Teil des Quelltexts; der Betreiber hat sie am{" "}
        <PlaceholderField value={CLOUDFLARE_SETTINGS_CHECKED} /> überprüft. Die Fußzeile der Anwendung verlinkt auf den
        genau laufenden Stand bei GitHub. Der Aufruf dieses Links führt Sie zu GitHub, Inc.; dabei wird die Adresse
        einer Wand nicht als Referer übermittelt.
      </p>

      <h2>6. Empfänger und Übermittlung in Drittländer</h2>
      <p>
        Empfänger ist <strong>Cloudflare, Inc. (USA)</strong> als Auftragsverarbeiter: alle Daten aus den Abschnitten 2
        und 3, die Daten der Wände gespeichert in Rechenzentren in der EU, die Verbindungsdaten am nächstgelegenen
        Standort, und beim Ordnen die Frage der Wand und die Texte der Zettel im KI-Dienst „Workers AI“, der auch
        außerhalb der EU rechnen kann (Abschnitt 3.4). Grundlage für die Übermittlung: das EU-US Data Privacy Framework,
        ergänzend die Standardvertragsklauseln.
      </p>
      <p>
        Nur wenn die Moderation mit einem eigenen KI-Schlüssel ordnet, kommt ein zweiter Empfänger hinzu: der eine
        Anbieter, den sie gewählt hat, <strong>Mistral AI</strong> (Frankreich), <strong>OpenAI</strong> (USA) oder{" "}
        <strong>Anthropic</strong> (USA). An ihn sendet der Browser der Moderation die Frage der Wand und die Texte der
        Zettel unmittelbar, unter dem Vertrag der Moderation mit diesem Anbieter, nicht unter einem des Betreibers
        (Abschnitt 3.5). Ob der Anbieter die Daten in ein Drittland übermittelt und auf welcher Grundlage, regelt dieser
        Vertrag; der Betreiber kennt ihn nicht.
      </p>
      <p>
        Sonst niemand. Der Betreiber gibt keine Daten an weitere Dritte weiter, verkauft nichts und gibt Inhalte einer
        Wand nur heraus, wenn er gesetzlich dazu verpflichtet ist.
      </p>

      <h2>7. Ihre Rechte</h2>
      <p>
        Sie haben nach der DSGVO das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
        Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen
        auf Grundlage des berechtigten Interesses (Art. 21). Außerdem können Sie sich bei einer
        Datenschutz-Aufsichtsbehörde beschweren (Art. 77), etwa bei der für Ihren Wohnort zuständigen Landesbehörde.
      </p>
      <p>
        Die praktische Seite, ehrlich beschrieben: Der Betreiber kann <strong>nicht</strong> erkennen, welche Person
        hinter einem Anzeigenamen steht. Es gibt keine Konten, keine E-Mail-Adressen, keine IP-Protokolle und kein
        Verzeichnis der Wände. Eine Anfrage muss deshalb den <strong>Link der Wand</strong> nennen (Art. 11 DSGVO),
        sonst kann der Betreiber die Daten nicht zuordnen. Dann gilt:
      </p>
      <ul>
        <li>
          <strong>Auskunft und Datenübertragbarkeit:</strong> Was die Wand über Sie hält, sehen Sie auf der Wand selbst
          nur zum Teil (Ihren Namen und ob Sie moderieren). Nicht sichtbar sind Ihr Sitzungsschlüssel (er liegt in Ihrem
          Browser), Ihre Kennung auf der Wand, der Zeitpunkt Ihres ersten Beitritts. Ihre eigenen Zettel sehen Sie auf
          der Fläche und in der Liste in jeder Phase, mit dem Wort „Deiner“; die der anderen nach dem Aufdecken. „Als
          Markdown sichern“ gibt Ihnen die Texte, die Sie auf der Wand sehen dürfen, als Datei, ohne Namen (Abschnitt
          3.1); was der Server über Sie als Person hält, steht nicht darin. Für eine vollständige Auskunft richten Sie
          eine Anfrage unter Nennung des Wand-Links an <OperatorEmail />.
        </li>
        <li>
          <strong>Berichtigung:</strong> Ihren Anzeigenamen können Sie auf einer Wand noch nicht selbst ändern; eine
          Funktion dafür gibt es noch nicht. Den Text eines Zettels ändert der Server nur auf den Befehl der Person, die
          ihn geschrieben hat, auf der Fläche oder in der Liste über „Bearbeiten“. Für eine Berichtigung richten Sie
          eine Anfrage unter Nennung des Wand-Links an <OperatorEmail />.
        </li>
        <li>
          <strong>Löschung:</strong> Ihre eigenen Angaben löschen Sie auf der Wand selbst, über „Mehr“ und „Meine
          Angaben löschen“; Ihre Zettel bleiben dabei ohne Namen auf der Wand (Abschnitt 3.3). Einen einzelnen Zettel
          löscht der Server auf den Befehl der Person, die ihn geschrieben hat, oder, nach dem Aufdecken, der
          Moderation, auf der Fläche oder in der Liste über „Löschen“. Die Moderation kann die ganze Wand löschen; sonst
          läuft sie ab (Abschnitt 3.3, dort auch zur plattformseitigen Wiederherstellungshistorie). Auf Anfrage unter
          Nennung des Links löscht der Betreiber die ganze Wand, weil er einzelne Einträge keiner Person zuordnen kann.
        </li>
      </ul>
      <p>
        <strong>Widerspruchsrecht (Art. 21 DSGVO).</strong> Soweit Daten auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO
        verarbeitet werden (Hosting, Abschnitt 2.1; Missbrauchsbremse und Tagesbudget, Abschnitt 2.2; ergänzende
        Grundlage für den Betrieb der Wände, Abschnitt 3.7), können Sie aus Gründen, die sich aus Ihrer besonderen
        Situation ergeben, jederzeit Widerspruch einlegen: <OperatorEmail />. Die praktische Folge, ehrlich beschrieben:
        Hosting und Missbrauchsbremse sind Bausteine, ohne die der Betreiber keine Wand betreiben kann; ein Widerspruch
        dagegen ist technisch gleichbedeutend mit der Nichtnutzung des Dienstes.
      </p>

      <h2>8. Sonstiges</h2>
      <p>
        <strong>Kinder.</strong> Das Angebot richtet sich an Teams im Arbeits- und Projektkontext und nicht an Kinder
        unter 16 Jahren. Es werden keine Altersangaben erhoben.
      </p>
      <p>
        <strong>Keine Pflicht zur Bereitstellung.</strong> Sie sind weder gesetzlich noch vertraglich verpflichtet,
        Daten anzugeben. Ohne einen Anzeigenamen können Sie einer Wand allerdings nicht beitreten; er darf ein Pseudonym
        sein. Zettel und Gruppen sind freiwillig.
      </p>
      <p>
        <strong>Adresse.</strong> {app} läuft unter ideabeam.de. Daneben gibt es eine Vorschau unter einer Adresse von
        Cloudflare (sie endet auf workers.dev), auf der neue Fassungen vor dem Start ausprobiert werden. Für sie gilt
        diese Erklärung ebenso. Die Vorschau hat einen eigenen, getrennten Speicher: Eine Wand der Vorschau gibt es
        unter ideabeam.de nicht, und umgekehrt. Die Browser-Einträge aus Abschnitt 4 legt Ihr Browser je Adresse
        getrennt ab.
      </p>
      <p>
        <strong>Wenn Sie schreiben.</strong> Schreiben Sie dem Betreiber eine E-Mail, etwa um Inhalte zu melden oder
        eine Frage zu stellen, verarbeitet er Ihre Adresse und Ihre Nachricht, um zu antworten (Art. 6 Abs. 1 lit. f
        DSGVO, das berechtigte Interesse, Anfragen zu beantworten). Die Nachricht wird gelöscht, sobald die Sache
        erledigt ist, es sei denn, eine gesetzliche Pflicht verlangt, sie länger aufzubewahren. Sie geht an niemanden
        weiter außer an den Anbieter des Postfachs.
      </p>
      <p>
        <strong>Änderungen.</strong> Diese Erklärung wird angepasst, wenn sich die Anwendung ändert, insbesondere, wenn
        ein Dienstleister hinzukommt oder wegfällt. Die jeweils aktuelle Fassung steht unter{" "}
        <Link to="/datenschutz">„Datenschutz“</Link> in der Fußzeile jeder Ansicht; das Datum oben zeigt den Stand. Eine
        gesonderte Benachrichtigung ist mangels Konten nicht möglich.
      </p>
    </>
  );
}
