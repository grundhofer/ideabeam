# KI über Anbieter: Gratis-Angebote und bezahlte EU-Angebote

Stand: 22.11.2026 · gehört zu [messung-0b.md](messung-0b.md)

Anlass ist deine Idee nach Etappe 0b: Das Ordnen läuft über kostenlose KI-Schnittstellen. Ein Verteiler prüft, wo
Kapazität frei ist. Wer zahlt, bekommt Verarbeitung in der EU, ohne Speicherung und ohne Training.

Geprüft sind die Seiten der Anbieter selbst (Preise, Limits, Bedingungen, Datennutzung), abgerufen am 22.11.2026.
Die Angaben zu Cloudflare und zu Googles EWR-Regel habe ich ein zweites Mal gegen die Seiten gelesen. Alles andere
stammt aus einem Recherchedurchgang. Was offen blieb, steht in Abschnitt 4. Eine rechtliche Bewertung ist das nicht.

## Ergebnis in Kürze

1. **Die Modellklasse reicht.** Bei Cloudflare ordnet `gemma-4-26b-a4b-it` die Testwände mit ARI 0,80 und 0,86
   (messung-0b.md, Abschnitt 7). Das beste Modell im Browser kam auf 0,45.
2. **Gratis ist fast nichts mehr.** Von elf geprüften Angeboten ist eines für uns brauchbar: Cloudflare Workers AI.
   Fünf haben keine Gratis-Schnittstelle mehr. Google verbietet die Gratis-Stufe für Nutzer im EWR.
3. **Bezahlt in der EU ist sehr billig.** Rund 0,3 Cent für das Ordnen einer Wand mit 250 Zetteln, ohne
   Speicherung, ohne Training, ohne Vertriebsgespräch.

## 1 Gratis-Angebote

| Anbieter | Gratis-Schnittstelle | Grenze | Training mit den Daten | Nutzer in der EU | Für uns |
|---|---|---|---|---|---|
| **Cloudflare Workers AI** | ja, ohne Karte | 10.000 Neuronen am Tag, je Konto | nein, keine Speicherung | erlaubt. Verarbeitung nicht auf die EU festlegbar | **brauchbar** |
| Groq | ja, ohne Karte | 8.000 Token je Minute, 200.000 am Tag (rund 11 Wände mit 250 Zetteln) | nein. Speicherung bis 30 Tage, abschaltbar | „not for consumer use“. Gespeichertes liegt in den USA | allenfalls Reserve |
| OpenRouter, Modelle mit `:free` | ja, ohne Karte | 50 Anfragen am Tag, 1.000 nach einmal 10 $ Guthaben | hängt am Anbieter dahinter, Training möglich | keine Einschränkung | nur mit Trainingsrisiko |
| Google Gemini | ja, ohne Karte | nicht veröffentlicht | ja, auch Durchsicht durch Menschen | **für Nutzer im EWR nur die bezahlte Stufe** | nein |
| NVIDIA | ja | nicht veröffentlicht | ja | nur Test, keine Personendaten | nein |
| SambaNova | ja | 20 Anfragen am Tag je Modell | ungeprüft | nur Erprobung, nicht für den Betrieb | nein |
| Cohere, Testschlüssel | ja | 1.000 Aufrufe im Monat | ungeprüft | ungeprüft | zu wenig |
| Cerebras | nein, nur 5 $ Probeguthaben mit Karte | – | – | – | nein |
| Mistral | nein, die Schnittstelle braucht Guthaben | – | – | – | nein |
| Together AI | nein, mindestens 15 $ | – | – | – | nein |
| Hugging Face | nein, kein Gratis-Guthaben | – | – | – | nein |
| GitHub Models | eingestellt am 30.07.2026 | – | – | – | nein |

Unser Ablauf braucht je Wand 23 Aufrufe. Bei OpenRouter wären 50 Anfragen am Tag also zwei Wände.

Mehrere Konten bei einem Anbieter, um Limits zu umgehen, verbieten Cloudflare, Google und OpenRouter ausdrücklich.
Mehrere Anbieter nebeneinander sind erlaubt.

### Was das Gratis-Kontingent von Workers AI hergibt

Gemessen am 22.11.2026 an den zwei Testwänden mit je 250 Zetteln (messung-0b.md, Abschnitt 7). Ablauf: Themen aus
allen Zetteln in einem Aufruf, Zuordnen in Stapeln zu 50, sieben Aufrufe, rund 9.800 Token Eingabe und 3.600 Token
Ausgabe.

| Modell bei Workers AI | ARI | Neuronen je Wand mit 250 Zetteln | Ordnungen am Tag gratis |
|---|---|---|---|
| `@cf/google/gemma-4-26b-a4b-it` | 0,83 | 187 | 54 |
| `@cf/zai-org/glm-4.7-flash` | 0,69 | 157 | 64 |
| `@cf/openai/gpt-oss-20b` | 0,59 | 259 | 39 |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | 0,73 | 451 | 22 |
| `@cf/openai/gpt-oss-120b` | 0,80 | 829 | 12 |

- Eine kleine Wand mit 30 Zetteln kostet mit `gemma-4-26b-a4b-it` 39 Neuronen. Daraus gerechnet braucht eine Wand
  mit 60 Zetteln rund 60 Neuronen: Das Kontingent reicht für rund 165 solche Ordnungen am Tag.
- Darüber kostet es 0,011 $ je 1.000 Neuronen und setzt Workers Paid voraus (5 $ im Monat).
- Das Kontingent gilt je Konto und wird um 00:00 UTC zurückgesetzt.
- Die Schnittstelle meldet den Verbrauch in jeder Antwort (`usage.neurons`).
- `@cf/qwen/qwen3-30b-a3b-fp8` stand noch in der Preisliste, war aber seit dem 20.11.2026 abgekündigt.

## 2 Bezahlte Angebote mit Verarbeitung in der EU

Preis je Wand: 13.500 Token Eingabe und 4.400 Token Ausgabe. Das ist der teurere Ablauf mit 23 Aufrufen aus
messung-0b.md, Abschnitt 2. Der Ablauf mit sieben Aufrufen braucht rund ein Viertel weniger.

| Anbieter | Modell | Preis je 1 Mio. Token, Eingabe / Ausgabe | Je Wand mit 250 Zetteln | Speicherung | Ort |
|---|---|---|---|---|---|
| **IONOS AI Model Hub** | Mistral Small 24B | 0,10 € / 0,30 € | 0,27 Cent | keine nach der Anfrage | Deutschland |
| OVHcloud AI Endpoints | gpt-oss-120b | 0,08 € / 0,40 € | 0,28 Cent | keine | Europa, Rechenzentrum nicht genannt |
| Scaleway Generative APIs | mistral-small-3.2 | 0,15 € / 0,35 € | 0,36 Cent | keine. Ausnahme: bis zwei Wochen nach Fehler 500 oder Missbrauch | Paris |
| Mistral | Mistral Small 4 | 0,15 $ / 0,60 $ | 0,47 Cent | 30 Tage. Keine Speicherung nur auf Antrag | EWR |
| AWS Bedrock, Stockholm | gpt-oss-120b | 0,15 $ / 0,60 $ | 0,47 Cent | einstellbar | EU |
| Cloudflare Workers AI, bezahlt | gemma-4-26b-a4b-it | 0,10 $ / 0,30 $ | 0,27 Cent | keine | nicht auf die EU festlegbar |

Alle sechs trainieren laut eigenen Seiten nicht mit den Daten. Bei Mistral ist die Voreinstellung für die bezahlte
Schnittstelle nicht eindeutig belegt.

Nicht passend für eine Ein-Personen-Lösung:

- **Azure OpenAI, EU Data Zone:** Speicherung zur Missbrauchsprüfung mit Durchsicht durch Menschen. Abschalten nur
  für betreute Kunden, für neue Modelle läuft auch das aus.
- **OpenAI direkt:** EU-Verarbeitung und keine Speicherung nur über den Vertrieb.
- **Anthropic direkt:** keine Verarbeitung in der EU wählbar.
- **Google Vertex AI:** teurer (0,7 bis 1 Cent je Wand), Protokolle zur Missbrauchsprüfung.

### Was das im Monat kostet

Mit IONOS, Mistral Small, zwei Ordnungen je Wand. Die Spalte für 60 Zettel ist auf die Zettelzahl umgerechnet,
nicht gemessen.

| Wände am Tag | 60 Zettel je Wand | 250 Zettel je Wand |
|---|---|---|
| 100 | rund 4 € | rund 16 € |
| 1.000 | rund 40 € | rund 160 € |
| 10.000 | rund 400 € | rund 1.600 € |

## 3 Was das für die Idee heißt

Entschieden am 22.11.2026 (PLAN.md, 7.2): Das Ordnen rechnet im Gratis-Kontingent von Cloudflare Workers AI, der
Browser ist Reserve, ein eigener Schlüssel ist ab v0.1 möglich, eine bezahlte Stufe kommt später.

- **Der Verteiler hat wenig zu verteilen.** Es gibt eine brauchbare Gratis-Quelle, keine zehn. Der Verteiler bleibt
  trotzdem sinnvoll, nur kleiner: eine geordnete Liste von Quellen, je Quelle ein Tageszähler, bei Fehler oder
  aufgebrauchtem Zähler die nächste Quelle, am Ende das Modell im Browser.
- **„Kapazität prüfen“ braucht keine eigene Anfrage.** Workers AI meldet nur einen Fehler, wenn das Kontingent
  aufgebraucht ist. Der Verbrauch steht in jeder Antwort, also zählt der Verteiler selbst mit. Groq nennt den Rest
  in den Kopfzeilen `x-ratelimit-remaining-*`, OpenRouter über `GET /api/v1/key`.
- **Die Gratis-Stufe muss nicht die mit Training sein.** Die einzige brauchbare Gratis-Quelle trainiert nicht und
  speichert nicht. Der Unterschied zur bezahlten Stufe wäre der Ort der Verarbeitung, nicht das Training.
- **Die bezahlte Stufe ist billig in der Technik, teuer im Drumherum.** 0,3 Cent je Wand sind kein Problem. Bezahlen
  ohne Konto, Rechnungen, Umsatzsteuer, Geschäftsbedingungen und ein Vertrag zur Auftragsverarbeitung für
  Firmenkunden sind es.

## 4 Nicht geprüft

- **Die Güte der Modelle bei den bezahlten Anbietern.** Gemessen sind fünf Modelle bei Cloudflare. Bei IONOS,
  OVHcloud, Scaleway und Mistral ist nichts gemessen.
- **Die Dauer mit Stapeln nebeneinander.** Bei Cloudflare dauerten sieben Aufrufe nacheinander 76 Sekunden. Die
  26 Sekunden für Stapel nebeneinander sind gerechnet.
- **Gemini:** die Gratis-Limits. Google zeigt sie nur nach der Anmeldung.
- **Groq:** ob die veröffentlichte Tabelle mit 8.000 Token je Minute die Gratis-Stufe ist, und wo gerechnet wird.
- **Mistral:** ob die bezahlte Schnittstelle in der Voreinstellung trainiert.
- **OpenRouter:** die Datenregeln der einzelnen Gratis-Modelle.
- **Scaleway:** Die Seite ließ sich nicht abrufen. Die Angaben stammen aus der öffentlichen Quelle der Doku, der
  Preis für gpt-oss-120b aus einem Suchtreffer.
- **OVHcloud:** ob die Preise die Umsatzsteuer enthalten, und der Standort.
- **Verträge zur Auftragsverarbeitung** von AWS, OVHcloud und Scaleway sind nicht geöffnet. Bei Cloudflare und
  IONOS sind sie laut Bedingungen Teil des Vertrags.
- **Recht:** ob das Ordnen bei einem Anbieter außerhalb der EU zur Zusage „Speicherung in der EU“ passt, und was
  eine bezahlte Stufe an Pflichten auslöst. Das braucht jemanden vom Fach.

## 5 Quellen und entscheidende Sätze

**Cloudflare Workers AI**

- Preise, geändert 18.11.2026: <https://developers.cloudflare.com/workers-ai/platform/pricing/>.
  „Our free allocation allows anyone to use a total of 10,000 Neurons per day at no charge.“ „All limits reset daily
  at 00:00 UTC.“ „$0.011 per 1,000 Neurons“.
- Datennutzung, geändert 16.10.2026: <https://developers.cloudflare.com/workers-ai/platform/data-usage/>.
  „Cloudflare does not use Customer Content processed by Workers AI to train AI models.“ „For standard inference
  requests that do not invoke a stateful feature, Cloudflare does not retain inputs or outputs after they are no
  longer needed to process the request and deliver the response“.
- Datenort, geändert 17.11.2026: <https://developers.cloudflare.com/data-localization/compatibility/>. Zeile
  „Workers AI“: Regional Services „Not compatible“.
- Bedingungen: <https://www.cloudflare.com/terms/>. Verboten ist Nutzung „in a manner that violates or is intended
  to circumvent Service-specific usage limits, quotas, or other restrictions“.

**Google Gemini API**, gültig ab 23.03.2026: <https://aistudio.google.com/docs/terms>

- „You may use only Paid Services when making API Clients available to users in the European Economic Area,
  Switzerland, or the United Kingdom.“
- „When you use Unpaid Services […] Google uses the content you submit to the Services and any generated responses
  to provide, improve, and develop Google products and services and machine learning technologies“.

**Groq:** <https://console.groq.com/docs/legal/services-agreement>, <https://console.groq.com/docs/your-data>

- „Groq is not permitted to use Inputs or Outputs for training or fine-tuning any AI Model Services or other
  models, unless explicitly granted permission or instructed by Customer.“
- „All customer data is retained in Google Cloud Platform (GCP) buckets located in the United States.“

**OpenRouter:** <https://openrouter.ai/docs/api-reference/limits>, <https://openrouter.ai/terms>

- „Making additional accounts or API keys will not affect your rate limits, as we govern capacity globally.“
- „Some Models may store or train on your Inputs for improving their own large language models“.

**Ohne Gratis-Schnittstelle**

- Mistral: <https://docs.mistral.ai/admin/user-management-finops/tier>. „Free mode […] doesn't include API access.“
- Cerebras: <https://inference-docs.cerebras.ai/support/rate-limits>. „Is there a permanently free tier? No.“
- Together AI: <https://docs.together.ai/docs/billing>. „Together AI doesn't currently offer free trials.“
- Hugging Face: <https://huggingface.co/docs/inference-providers/pricing>.
- GitHub Models: <https://docs.github.com/en/github-models/use-github-models/prototyping-with-ai-models>.
  „As of July 30, 2026, GitHub Models has been fully retired.“

**Nur zur Erprobung**

- NVIDIA: Trial Terms of Service vom 19.09.2025. „you may only use the API Service for internal testing and
  evaluation purposes, not in production.“
- SambaNova: <https://docs.sambanova.ai/docs/en/models/rate-limits>. Modelle „should not be used in production
  environments“.

**Bezahlt, EU**

- Scaleway: <https://www.scaleway.com/en/docs/generative-apis/reference-content/data-privacy/>. „By default we apply
  a Zero Data Retention Policy“.
- Mistral: <https://legal.mistral.ai/terms/privacy-policy>. Eingaben und Ausgaben bleiben „thirty (30) rolling
  days to monitor abuse (unless zero data retention is activated)“.
- Azure: <https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy>.
- IONOS AI Model Hub und OVHcloud AI Endpoints: Preisseiten der Anbieter. Die Sätze zur Speicherung kamen über eine
  Zusammenfassung, nicht im Wortlaut.
