# Sprachmodelle bei Cloudflare Workers AI ordnen die Testwände

Erzeugt von `tools/eval_cf.py`, Stand 2026-11-22 14:24. Ablauf wie der Nebenlauf „Themen in einem Aufruf, Stapel 50“ aus `eval_llm.py`: je Wand 250 Zettel, 2 Aufrufe für die Themen, 5 für das Zuordnen, ein Startwert, Temperatur 0. Über das Konto geschickt wurden nur die erfundenen Zettel des Testkorpus.

| Modell | Themen | ARI (Einarbeitung / Stadtteil) | Reinheit | ungültig | Token je Wand, Eingabe / Ausgabe | Neuronen je Wand | Ordnungen am Tag gratis | Zeit je Wand, nacheinander | nebeneinander | Antwortform |
|---|---|---|---|---|---|---|---|---|---|---|
| `@cf/google/gemma-4-26b-a4b-it` | 6,0 | 0,83 (0,80 / 0,86) | 0,93 | 0,0 % | 9830 / 3563 | 187 | 54 | 76 s | 26 s | schema_wrapped |
| `@cf/openai/gpt-oss-20b` | 6,0 | 0,59 (0,74 / 0,43) | 0,82 | 0,2 % | 9386 / 3236 | 259 | 39 | 37 s | 13 s | schema_wrapped |
| `@cf/openai/gpt-oss-120b` | 6,0 | 0,80 (0,84 / 0,75) | 0,92 | 0,0 % | 9637 / 7665 | 829 | 12 | 137 s | 49 s | schema_wrapped |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | 6,0 | 0,73 (0,81 / 0,64) | 0,88 | 0,0 % | 9643 / 2843 | 451 | 22 | 82 s | 31 s | schema_wrapped |
| `@cf/zai-org/glm-4.7-flash` | 6,0 | 0,69 (0,75 / 0,64) | 0,88 | 0,0 % | 9267 / 2914 | 157 | 64 | 188 s | 131 s | schema_wrapped |
| `@cf/google/gemma-4-26b-a4b-it [Titel auf Deutsch]` | 5,0 | 0,85 (0,75 / 0,95) | 0,92 | 0,0 % | 9902 / 4007 | 199 | 50 | 76 s | 31 s | schema_wrapped |
| `@cf/google/gemma-4-26b-a4b-it [30 Zettel, Titel auf Deutsch]` | 5,0 | 0,83 (0,71 / 0,94) | 0,93 | 0,0 % | 1616 / 877 | 39 | 259 | 20 s | 20 s | schema_wrapped |

Verbraucht in allen Läufen: 4276 Neuronen (von der Schnittstelle je Antwort gemeldet, nicht aus der Abrechnung gelesen). Zwei Nebenläufe stehen am Ende der Tabelle: Titel auf Deutsch, und eine kleine Wand aus den ersten 30 Zetteln.

- `@cf/google/gemma-4-26b-a4b-it`, onboarding: Technical Setup and Access; Documentation and Knowledge Management; Social Integration and Culture; Mentorship and Support Systems; Onboarding Structure and Goals; Task Management and Workload
- `@cf/google/gemma-4-26b-a4b-it`, stadtteil: Local Commerce and Services; Community Sharing and Socializing; Public Infrastructure and Reporting; Mobility and Transport; Events and Neighborhood Life; Accessibility and Inclusion
- `@cf/openai/gpt-oss-20b`, onboarding: Onboarding Structure; Technical Setup; Mentorship & Support; Social Integration; Knowledge Sharing; Feedback & Evaluation
- `@cf/openai/gpt-oss-20b`, stadtteil: Community Services; Local Business & Events; Public Safety & Maintenance; Accessibility & Mobility; Neighborhood Interaction; Resource Sharing & Sustainability
- `@cf/openai/gpt-oss-120b`, onboarding: Pre‑Start Setup; Structured Learning Path; Guided Support & Mentorship; Knowledge Base & Docs; Social & Cultural Integration; Ongoing Feedback & Review
- `@cf/openai/gpt-oss-120b`, stadtteil: Community Help & Sharing; Local News & Events; Infrastructure & Safety Reporting; Mobility & Transportation; Local Business & Discounts; Public Services & Accessibility
- `@cf/mistralai/mistral-small-3.1-24b-instruct`, onboarding: Onboarding Process; Technical Onboarding; Support and Guidance; Communication and Integration; Documentation and Tools; Expectations and Feedback
- `@cf/mistralai/mistral-small-3.1-24b-instruct`, stadtteil: Local Services; Community Building; Urban Maintenance; Getting Around; Local Events; Neighbourhood Updates
- `@cf/zai-org/glm-4.7-flash`, onboarding: Structured Onboarding Process; Buddy and Mentorship; Technical Setup and Tools; Documentation and Knowledge Sharing; Social Integration and Culture; Feedback and Communication
- `@cf/zai-org/glm-4.7-flash`, stadtteil: Local Services and Shops; Community and Social Connection; Maintenance and Infrastructure; Transport and Mobility; Sharing and Resource Exchange; Information and Discovery
- `@cf/google/gemma-4-26b-a4b-it [Titel auf Deutsch]`, onboarding: IT-Infrastruktur und Hardware; Wissensmanagement und Dokumentation; Soziale Integration und Mentoring; Strukturierter Onboarding-Prozess; Feedback und Kommunikation
- `@cf/google/gemma-4-26b-a4b-it [Titel auf Deutsch]`, stadtteil: Lokales Gewerbe und Gastronomie; Nachbarschaftshilfe und Austausch; Mobilität und Verkehr; Mängel- und Schadensmeldung; Events und Gemeinschaft
- `@cf/google/gemma-4-26b-a4b-it [30 Zettel, Titel auf Deutsch]`, onboarding: IT und technische Infrastruktur; Mentoring und soziale Integration; Dokumentation und Wissensmanagement; Ziele und Erwartungsmanagement; Arbeitsabläufe und praktische Einarbeitung
- `@cf/google/gemma-4-26b-a4b-it [30 Zettel, Titel auf Deutsch]`, stadtteil: Lokaler Handel & Dienstleistungen; Nachbarschaftshilfe & Community; Verkehr & Mobilität; Mängel & Stadtverwaltung; Events & Kultur
