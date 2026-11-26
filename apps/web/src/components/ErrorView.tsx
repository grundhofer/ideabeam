import { useTranslation } from "react-i18next";
import { Icon } from "../sebaro/react/Icon";
import { ActionZone } from "../sebaro/react/ActionZone";
import { View } from "./View";

/** What every route shows when it fails: what is wrong and what to do. A failure of the shell itself reaches the
 *  root's boundary: this view then stands without the frame. */
export function ErrorView({ back }: { back?: string }) {
  const { t } = useTranslation();
  return (
    <View
      name="fehler"
      type="state-error"
      title={t("error.title")}
      back={back}
      zone={
        <ActionZone>
          <button className="sb-primary-action" type="button" onClick={() => window.location.reload()}>
            <Icon name="refresh" />
            <span className="sb-primary-action__label">{t("error.retry")}</span>
          </button>
        </ActionZone>
      }
    >
      <div className="sb-container">
        <p>{t("error.text")}</p>
      </div>
    </View>
  );
}
