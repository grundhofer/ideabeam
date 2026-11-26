// accessibility.de.tsx: the German accessibility statement. Its frame is RetroBeam's statement (docs/HERKUNFT.md):
// WCAG 2.2 AA as the target, not as a result (sebaro ZUG-01); every check with one of the four state words
// (sebaro HAL-04: bestanden, offen, übersprungen with its reason, nicht bestanden), only checks that ran say
// „bestanden“, screen readers and real devices stay „offen“ until they ran (ZUG-08); no conformance claimed, only
// „teilweise“ with the list. What it says about IdeaBeam is this product's, each line held against a test or against
// apps/web/CHECKS.md at the state of 2026-11-25 (stage 5, step B). That the BFSG does not apply is the operator's
// statement (2026-11-26, PLAN.md 7.2 no. 31): IdeaBeam falls under one of its exceptions; the page names no ground,
// since the operator named none. So the page is published voluntarily and names no market surveillance authority; no lawyer checked the
// exception, and sebaro's own reading (ZUG-01, note) is not repeated here. A draft until the operator has read it
// (NOTICE_REVIEWED); no lawyer has read it. Change it together with
// accessibility.en.tsx, and whenever a check is added or a limitation is found or removed (then STATEMENT_DATE too).
import { Link } from "react-router";
import { name as app } from "../../sebaro.product.json";
import { OperatorBlock } from "./parts";

export function AccessibilityDe() {
  return (
    <>
      <p>
        Diese Seite beschreibt, wie sich {app} ohne Maus, mit einem Screenreader, mit großer Schrift oder mit weniger
        Bewegung benutzen lässt, was dafür geprüft wurde und was nicht. Nach Angabe des Betreibers fällt {app} unter
        eine Ausnahme des Barrierefreiheitsstärkungsgesetzes (BFSG). Diese Erklärung wird freiwillig veröffentlicht;
        Barrieren kannst du trotzdem melden (siehe „Barrieren melden“).
      </p>

      <h2>Was {app} ist</h2>
      <p>
        {app} ist eine Wand für ein Brainstorming im Team. Eine Person legt eine Wand mit einer Frage an und teilt den
        Link; alle anderen treten mit einem Anzeigenamen bei, ohne Konto. Alle schreiben Zettel, zunächst verdeckt, bis
        die Moderation aufdeckt. Danach ordnet eine KI die Zettel auf Wunsch der Moderation in Gruppen, oder alle ordnen
        von Hand. Das Ergebnis lässt sich als Markdown-Datei sichern. {app} ist kostenlos, auf Deutsch und auf Englisch,
        und ein privates, nicht gewerbliches Projekt einer Person.
      </p>

      <h2>So benutzt du {app}</h2>
      <p>
        Eine Wand gibt es in zwei Darstellungen mit denselben Aktionen: als <strong>Fläche</strong>, auf der Zettel und
        Gruppen frei liegen, und als <strong>Liste</strong> mit den Gruppen als Überschriften und den Zetteln als
        Zeilen. Umgeschaltet wird mit „Fläche“ und „Liste“ oben auf der Wand. Auf einem schmalen Bildschirm öffnet sich
        eine Wand als Liste, solange du nichts anderes gewählt hast. Die Liste ist der Weg für Screenreader.
      </p>

      <h3>Tastatur</h3>
      <ul>
        <li>
          Der erste Tabstopp jeder Seite ist der Link „Zum Inhalt“. Er erscheint, sobald er den Fokus hat, und führt am
          Kopf der Seite vorbei zum Inhalt.
        </li>
        <li>
          Fehlt in einem Formular etwas, etwa die Frage einer neuen Wand oder der Name an der Tür einer Wand, steht der
          Satz am Feld, und der Fokus springt dorthin.
        </li>
        <li>
          Die Fläche ist ein einziger Tabstopp. Dort gehen die Pfeiltasten von Zettel zu Zettel, G zur nächsten Gruppe;
          Eingabe ändert den Text oder den Titel, Entf löscht, N schreibt einen neuen Zettel. M bewegt den Zettel oder
          die Gruppe mit den Pfeiltasten, mit Umschalt ändert sich die Größe einer Gruppe; Eingabe legt ab, Esc bricht
          ab. V öffnet „Verschieben nach …“ mit den Gruppen als Auswahl: Das ersetzt das Ziehen. Die Leertaste wählt
          einen Zettel aus, Umschalt mit den Pfeiltasten wählt weitere dazu. Plus und Minus zoomen, 0 zeigt alles. Die
          Fläche nennt diese Tasten in ihrer Beschreibung, und auf breiten Bildschirmen zeigt die Taste „Tasten“ sie
          unter der Fläche.
        </li>
        <li>
          In der Liste hat jede Zeile ihr Menü „Mehr zu …“ mit „Bearbeiten“, „Verschieben nach …“ und „Löschen“, jede
          Gruppe ihres.
        </li>
        <li>
          Menüs und Dialoge schließen mit Escape, und der Fokus kehrt zu der Taste zurück, die sie geöffnet hat. Die
          Befehlspalette öffnet sich mit Strg+K (auf dem Mac ⌘K).
        </li>
        <li>
          Bedienelemente zeigen den Fokusrahmen von sebaro, dem Designsystem von {app}. Geprüft ist das nicht für jedes
          Element.
        </li>
      </ul>

      <h3>Screenreader</h3>
      <p>
        Die Seiten haben Überschriften, Landmarken und die Sprache der Seite. Auf der Wand sagt eine Statuszeile an, was
        sich ändert, etwa wie viele Zettel ausgewählt sind oder dass die KI ordnet; wird eine Änderung nicht übernommen,
        meldet es ein Hinweis. Die Fläche gibt sich einem Screenreader als Listenfeld ihrer Gruppen und Zettel zu
        erkennen, mit den Tasten in ihrer Beschreibung. Bequemer ist die Liste der Wand. Wer einen Zettel geschrieben
        hat, sagt {app} niemandem, auch keinem Screenreader; am eigenen Zettel steht „Deiner“. Mit einem Screenreader
        getestet ist nichts davon.
      </p>

      <h3>Touch</h3>
      <p>
        Auf der Fläche verschiebt ein Finger die Ansicht oder einen Zettel, zwei Finger verschieben und zoomen. Mehrere
        Zettel wählst du ohne Umschalttaste aus, wenn du „Auswählen“ in den Werkzeugen der Fläche einschaltest: Dann
        nimmt jeder Druck auf einen Zettel ihn in die Auswahl oder heraus. In der Liste verschiebt „Verschieben nach …“
        einen Zettel nach dem anderen.
      </p>

      <h3>Große Schrift</h3>
      <p>
        {app} folgt der Schriftgröße deines Browsers. Ausgezoomt zeichnet die Fläche ihre Zettel kleiner als diese
        Schrift; Plus zoomt hinein, und die Liste zeigt jeden Text in der eingestellten Größe.
      </p>

      <h3>Bewegung</h3>
      <p>
        Wendet die Moderation einen Vorschlag der KI an, gleiten die Zettel an ihre neuen Plätze, höchstens 600
        Millisekunden lang. Hast du in deinem System eingestellt, dass du weniger Bewegung möchtest, oder in den
        Einstellungen von {app} „Bewegung immer reduzieren“ eingeschaltet, springen sie stattdessen. Menüs und Dialoge
        blenden auch dann in 200 Millisekunden ein.
      </p>

      <h3>Zeit</h3>
      <p>
        Die Moderation kann für das Schreiben eine Uhr stellen. Läuft sie ab, sperrt nichts: Alle schreiben weiter, bis
        die Moderation aufdeckt.
      </p>

      <h3>Hell oder Dunkel, Sprache</h3>
      <p>
        Beim ersten Besuch folgt {app} der Einstellung deines Systems, hell oder dunkel. Außerhalb einer Wand wechselt
        die Taste „Hell oder Dunkel“ im Kopf der Seite, auf einer Wand das Menü „Mehr“; dort und in den Einstellungen
        gibt es außerdem den Farbton „Kühl“ oder „Warm“. Die Sprache wechselst du mit „DE / EN“ im Kopf der Seite oder
        im Menü „Mehr“ einer Wand, ohne Neuladen. {app} speichert diese Wahl in deinem Browser (siehe{" "}
        <Link to="/datenschutz">Datenschutz</Link>).
      </p>

      <h3>Ergebnis und Link</h3>
      <p>
        „Als Markdown sichern“ gibt dir die Wand als einfache Textdatei, die Gruppen als Überschriften und die Zettel
        als Listenpunkte. Den QR-Code der Wand („QR-Code zeigen“ im Menü „Mehr“) zeigt {app} dunkel auf hell, auch im
        dunklen Modus, und darunter denselben Link als Text, mit „Link kopieren“.
      </p>

      <h2>Anforderungen und Prüfstand</h2>
      <p>
        Als Ziel gilt die Stufe AA der Web Content Accessibility Guidelines (WCAG) 2.2. {app} ist damit{" "}
        <strong>teilweise vereinbar</strong>: Die automatischen Prüfungen unten finden auf den geprüften Seiten nichts,
        aber vieles ist nicht oder nicht von Hand geprüft, und die bekannten Einschränkungen stehen weiter unten. Eine
        vollständige Prüfung gegen die WCAG hat nicht stattgefunden.
      </p>
      <p>
        Wird bei einer Entscheidung Barrierefreiheit gegen ein anderes Ziel abgewogen, kann das andere Ziel vorgehen.
        Jede solche bewusste Abweichung steht mit ihrem Grund unter den bekannten Einschränkungen. Derzeit gibt es
        keine.
      </p>
      <p>
        Jede Prüfung unten hat einen von vier Zuständen: bestanden, offen, übersprungen (mit Grund) oder nicht
        bestanden. Die Ergebnisse stammen von den Läufen am Tag dieser Fassung (oben). Die automatischen Prüfungen
        laufen bei jeder Änderung am Quelltext, alle im Browser Chromium.
      </p>

      <h3>Automatische Prüfungen</h3>
      <ul>
        <li>
          Das Werkzeug axe-core 4.13.0 prüft die Regeln für WCAG 2.0, 2.1 und 2.2 (Stufen A und AA): jede Ansicht von{" "}
          {app} mit ihren Menüs und Dialogen, darunter die Wand als Fläche und als Liste in jedem Abschnitt (verdeckt,
          aufgedeckt, mit Uhr, beim Ordnen, mit eigenem KI-Schlüssel), jeweils hell bei 390 Pixel und dunkel bei 1440
          Pixel Breite. Die Fläche und die Liste einer Wand mit Gruppen, den QR-Code, das Impressum, die
          Datenschutzerklärung und diese Seite prüft es zusätzlich hell bei 1440 und dunkel bei 390 Pixel, die drei
          Rechtstexte auf Deutsch und auf Englisch. Ergebnis: bestanden, ohne eingetragene Ausnahme. Ein solches
          Werkzeug findet nur einen Teil möglicher Barrieren.
        </li>
        <li>
          Seitliches Scrollen und Text, den ein Rahmen abschneidet, auf denselben Seiten bei 390 und 1440 Pixel:
          bestanden. Die Fläche schneidet mit Absicht ab, was außerhalb ihrer Ansicht liegt; geprüft ist sie so, wie sie
          sich öffnet, mit allen Zetteln in der Ansicht.
        </li>
        <li>
          Doppelte Schriftgröße (200 %) bei 1440 Pixel Breite, hell, für die Startseite, die Tür einer Wand und die Wand
          in ihren Abschnitten: kein seitliches Scrollen, kein abgeschnittener Text, axe ohne Befund: bestanden.
        </li>
        <li>
          Tests nur mit der Tastatur: eine Wand anlegen (mit dem Satz am Feld zuerst) und an ihrer Tür beitreten; die
          Wand über den Dialog löschen, mit dem Fokus zurück nach Escape; „Hell oder Dunkel“ und die Sprache im Kopf der
          Seite und im Menü „Mehr“; die Befehlspalette; auf der Fläche einen Zettel schreiben, ändern, bewegen und
          löschen, Gruppen bewegen, in der Größe ändern, umbenennen und löschen, mehrere Zettel auswählen; in der Liste
          das Menü einer Zeile und „Verschieben nach …“; ordnen, verwerfen, anwenden und zurücknehmen in der Liste:
          bestanden. Das ist kein Durchgang durch alle Aufgaben.
        </li>
        <li>
          Die vier festen Aufgaben von sebaro nur mit der Tastatur: etwas anlegen (eine Wand) bestanden; es nach einer
          Rückfrage löschen bestanden; zwischen Hell und Dunkel wechseln bestanden; einen Beleg öffnen übersprungen,
          Grund: {app} hat keine Belege.
        </li>
        <li>
          Reduzierte Bewegung, die des Systems und die Einstellung von {app}: Die Zettel springen beim Ordnen an ihren
          Platz, ohne zu gleiten: bestanden.
        </li>
        <li>
          Touch, nachgestellt im Browser: „Auswählen“ mit einzelnen Drücken, zwei Finger auf der Fläche: bestanden. Das
          ist kein echtes Gerät.
        </li>
      </ul>

      <h3>Offene Prüfungen</h3>
      <ul>
        <li>Screenreader, zum Beispiel VoiceOver, NVDA oder TalkBack, auf der Fläche und in der Liste: offen.</li>
        <li>Die Browser Firefox und Safari: offen. Alle Prüfungen laufen nur in Chromium.</li>
        <li>Echte Handys und Tablets mit Touch, auch die Bildschirmtastatur: offen.</li>
        <li>
          Ein Durchgang durch alle Aufgaben nur mit der Tastatur: offen. Ohne eigenen Test sind etwa Aufdecken, die Uhr,
          „Meine Angaben löschen“, „Als Markdown sichern“ und „QR-Code zeigen“.
        </li>
        <li>Ein sichtbarer Fokusrahmen an jedem Bedienelement: offen. Keine Prüfung liest ihn.</li>
        <li>
          axe hell bei 1440 und dunkel bei 390 Pixel für die übrigen Ansichten, und auf Englisch außer Startseite, Tür
          und Rechtstexten: offen.
        </li>
        <li>Abgeschnittener Text auf einer Fläche, die verschoben oder gezoomt wurde: offen.</li>
        <li>Erzwungene Farben und Kontrastmodi des Systems: offen.</li>
        <li>
          Vergrößern im Browser auf 400 %, also eine Breite von 320 Pixel: offen. Die Prüfung oben verdoppelt die
          Schriftgröße; das ist nicht dasselbe.
        </li>
        <li>Größere Abstände zwischen Zeilen, Absätzen, Wörtern und Buchstaben: offen.</li>
        <li>Die Markdown-Datei in einem Programm, das sie vorliest: offen.</li>
      </ul>

      <h2>Bekannte Einschränkungen</h2>
      <p>Weil noch keine Prüfung von Hand gelaufen ist, ist diese Liste nicht vollständig.</p>
      <ul>
        <li>
          Die Fläche ist für Augen und Zeiger gebaut. Für einen Screenreader ist sie eine lange Liste ohne die Lage der
          Zettel; die Liste der Wand ist der bessere Weg. Gehört hat beides niemand.
        </li>
        <li>
          Den Rahmen einer Gruppe und seinen Griff für die Größe zieht ein Zeiger; mit der Tastatur gehen M und Umschalt
          mit den Pfeiltasten. Mit einem Finger auf einem echten Gerät ist das nicht versucht.
        </li>
        <li>Ausgezoomt ist der Text auf der Fläche kleiner als die eingestellte Schrift (siehe „Große Schrift“).</li>
        <li>Screenreader, echte Geräte, Firefox und Safari sind nicht getestet.</li>
      </ul>

      <h2>Barrieren melden</h2>
      <p>Wenn dir in {app} eine Barriere begegnet oder du etwas nicht benutzen kannst, schreib an:</p>
      <OperatorBlock emailLabel="E-Mail:" />
      <p>
        Hilfreich ist, welche Seite es war, welchen Browser und welche Hilfsmittel du benutzt. Eine Antwortzeit ist
        nicht zugesagt.
      </p>
    </>
  );
}
