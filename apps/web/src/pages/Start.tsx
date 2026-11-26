// Start.tsx: the front door, built like RetroBeam's and FokusBeam's: the first screen is only the claim, one
// sentence and the primary action; everything else follows in sections: what a wall is, with a picture of one,
// how a brainstorming goes, why, questions and answers, and the invitation again. A browser that has been on a wall
// finds the way back onto it right under the action. The action appears at both ends of the page and leads to the
// same form; the second one is outlined: one primary action per view.
//
// Every claim of the first section is a link to the answer that carries its caveats („Gespeichert in der EU“ is
// only honest next to the answer that says where the connection ends and where the AI computes). The texts say what
// v0.1 does as built (stage 5, step B): hidden writing, revealing, grouping by Cloudflare's AI with its caveat, the
// Markdown file, the QR code. The moderation's own key is not offered while no provider is measured, so they do not
// name it.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { MAX_NOTES, MAX_ONLINE, WALL_DAILY_RUNS } from "@ideabeam/shared";
import { View } from "../components/View";
import { Icon } from "../sebaro/react/Icon";
import { useWalls } from "../store/walls";

const STEPS = ["open", "write", "arrange"] as const;
const WHY = ["equal", "fast", "data", "languages"] as const;
const TRUST = ["account", "where", "ai", "tracking"] as const;
const FAQ = [
  { group: "basics", questions: ["cost", "account", "admin", "limits"] },
  { group: "privacy", questions: ["ai", "where", "howLong", "tracking"] },
] as const;

const faqId = (key: string) => `app-faq-${key}`;
// the limits an answer names, as the rules of the product state them
const LIMITS = { online: MAX_ONLINE, notes: MAX_NOTES, runs: WALL_DAILY_RUNS };

/** A fragment alone scrolls to a <details> and leaves it shut in some browsers: the claim's link opens the answer
 *  it points at as well. Nothing is stored. */
function openAnswer(id: string): HTMLElement | null {
  const answer = document.getElementById(id);
  if (answer instanceof HTMLDetailsElement) answer.open = true;
  return answer;
}

/** A wall that has been grouped, as a picture of what the product is: sample data, said so, and no control in it. */
function Preview() {
  const { t } = useTranslation();
  const groups = [
    { heading: "group1", notes: ["note1", "note2"] },
    { heading: "group2", notes: ["note3", "note4"] },
  ] as const;
  return (
    <figure className="app-preview">
      <div className="app-preview__frame" role="img" aria-label={t("landing.preview.label")}>
        <p className="app-preview__wall">{t("landing.preview.question")}</p>
        <p className="app-preview__state">{t("landing.preview.state")}</p>
        {groups.map(({ heading, notes }) => (
          <div key={heading}>
            <p className="sb-list-header">{t(`landing.preview.${heading}`)}</p>
            <ul className="sb-list">
              {notes.map((note) => (
                <li className="sb-list-row" key={note}>
                  <div className="sb-list-row__main">
                    <p className="sb-list-row__title">{t(`landing.preview.${note}`)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <figcaption className="app-preview__caption">{t("landing.preview.caption")}</figcaption>
    </figure>
  );
}

export default function Start() {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const [last] = useWalls((state) => state.walls);

  // the browser's own scroll to a fragment runs before the answers are drawn: a link that arrives with one opens
  // its answer and goes there
  useEffect(() => {
    if (hash.startsWith("#app-faq-")) openAnswer(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <View name="start" type="overview" title={t("landing.tab")} wide ownHeading>
      <section className="sb-container sb-section" aria-labelledby="app-h-claim">
        <div className="sb-stack sb-stack--group">
          <h1 id="app-h-claim" tabIndex={-1}>
            {t("landing.claim")}
          </h1>
          <p className="sb-page-lead__text app-measure">{t("landing.lede")}</p>
          <p>
            <Link className="sb-primary-action" to="/neu">
              <Icon name="plus" />
              <span className="sb-primary-action__label">{t("new.title")}</span>
            </Link>
          </p>
          <p className="app-muted app-measure">{t("landing.ctaHint")}</p>
          {last && (
            <p className="app-measure">
              <Link to={`/w/${last.id}`}>{t("start.continue", { question: last.question })}</Link>
              {" · "}
              <Link to="/waende">{t("start.all")}</Link>
            </p>
          )}
        </div>
      </section>

      <section className="sb-container sb-section" aria-label={t("landing.preview.label")}>
        <div className="app-landing-pair">
          <div className="sb-prose">
            <p>{t("landing.description")}</p>
            <ul>
              {TRUST.map((key) => (
                <li key={key}>
                  <a href={`#${faqId(key)}`} onClick={() => openAnswer(faqId(key))}>
                    {t(`landing.trust.${key}`)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <Preview />
        </div>
      </section>

      <section className="sb-container sb-section" aria-labelledby="app-h-how">
        <h2 className="sb-section__title" id="app-h-how">
          {t("landing.howTitle")}
        </h2>
        <p className="sb-page-lead__text app-measure">{t("landing.howRoles")}</p>
        <ol className="app-landing-grid app-landing-grid--three">
          {STEPS.map((step) => (
            <li className="sb-stack" key={step}>
              <h3>{t(`landing.steps.${step}.title`)}</h3>
              <p>{t(`landing.steps.${step}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="sb-container sb-section" aria-labelledby="app-h-why">
        <h2 className="sb-section__title" id="app-h-why">
          {t("landing.whyTitle")}
        </h2>
        <ul className="app-landing-grid app-landing-grid--two">
          {WHY.map((key) => (
            <li className="sb-stack" key={key}>
              <h3>{t(`landing.why.${key}.title`)}</h3>
              <p>{t(`landing.why.${key}.text`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="sb-container sb-section" aria-labelledby="app-h-faq">
        <h2 className="sb-section__title" id="app-h-faq">
          {t("landing.faqTitle")}
        </h2>
        <div className="sb-stack sb-stack--group">
          {FAQ.map(({ group, questions }) => (
            <div className="sb-stack" key={group}>
              <h3>{t(`landing.faqGroups.${group}`)}</h3>
              <div className="sb-faq">
                {questions.map((key) => (
                  <details className="sb-faq__item" id={faqId(key)} key={key}>
                    <summary className="sb-faq__question">
                      <span>{t(`landing.faq.${key}.q`)}</span>
                      <Icon name="chevron-down" />
                    </summary>
                    <div className="sb-faq__answer">
                      <p>{t(`landing.faq.${key}.a`, LIMITS)}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sb-container sb-section" aria-labelledby="app-h-closing">
        <div className="sb-stack sb-stack--group">
          <h2 className="sb-section__title" id="app-h-closing">
            {t("landing.closingTitle")}
          </h2>
          <p className="sb-page-lead__text app-measure">{t("landing.closingText")}</p>
          <p>
            <Link className="sb-secondary-action" to="/neu">
              {t("new.title")}
            </Link>
          </p>
          <p className="app-muted app-measure">{t("landing.notice")}</p>
        </div>
      </section>
    </View>
  );
}
