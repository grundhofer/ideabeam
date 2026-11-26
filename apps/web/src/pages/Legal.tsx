// Legal.tsx: „Impressum“ and „Datenschutz“, which the footer of every view links. The texts are long-form content
// with headings, lists and links, so they stand in src/content/ as markup, one file per page and language, not in
// the string tables; the operator's details come from src/content/operator.ts. While a placeholder is left there,
// the page says that it is a draft.
import { useTranslation } from "react-i18next";
import { View } from "../components/View";
import { AccessibilityDe } from "../content/accessibility.de";
import { AccessibilityEn } from "../content/accessibility.en";
import { ImprintDe } from "../content/imprint.de";
import { ImprintEn } from "../content/imprint.en";
import { DRAFT, NOTICE_DATE, STATEMENT_DATE } from "../content/operator";
import { PrivacyDe } from "../content/privacy.de";
import { PrivacyEn } from "../content/privacy.en";
import { useLang } from "../i18n";
import { date } from "../lib/format";
import { Icon } from "../sebaro/react/Icon";

const CONTENT = {
  imprint: { de: ImprintDe, en: ImprintEn },
  privacy: { de: PrivacyDe, en: PrivacyEn },
  accessibility: { de: AccessibilityDe, en: AccessibilityEn },
} as const;

// the date line of a text that has one: the privacy notice and the accessibility statement
const AS_OF: Partial<Record<keyof typeof CONTENT, string>> = { privacy: NOTICE_DATE, accessibility: STATEMENT_DATE };

export default function Legal({ page }: { page: keyof typeof CONTENT }) {
  const { t } = useTranslation();
  const lang = useLang();
  const Content = CONTENT[page][lang];
  const asOf = AS_OF[page];
  return (
    <View name={page} type="about" title={t(`legal.${page}`)} back="/einstellungen" noPrimary>
      <div className="sb-container sb-stack sb-stack--group">
        {DRAFT && (
          <div className="sb-callout sb-callout--warning" role="note">
            <Icon name="warning--filled" size={20} />
            <p className="sb-callout__text">{t("legal.draft")}</p>
          </div>
        )}
        <div className="sb-prose">
          {asOf !== undefined && <p>{t("legal.asOf", { date: date(lang, asOf) })}</p>}
          <Content />
        </div>
      </div>
    </View>
  );
}
