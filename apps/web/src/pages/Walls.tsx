// Walls.tsx: „Meine Wände“, the walls this browser has been on, the one visited last first: flat rows that lead
// back to a wall. The list lives on this device only; there is no account that could keep it. A row's menu takes
// the wall off the list: that drops what this device knows about it (who one was there, and the admin token), so
// it asks first. The wall itself is not touched.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { View } from "../components/View";
import { useLang } from "../i18n";
import * as fmt from "../lib/format";
import { ActionZone } from "../sebaro/react/ActionZone";
import { Dialog } from "../sebaro/react/Dialog";
import { Icon } from "../sebaro/react/Icon";
import { MenuButton } from "../sebaro/react/Menu";
import { useWalls, type KnownWall } from "../store/walls";

export default function Walls() {
  const { t } = useTranslation();
  const lang = useLang();
  const walls = useWalls((state) => state.walls);
  const adminTokens = useWalls((state) => state.adminTokens);
  /** the wall the dialog asks about */
  const [removing, setRemoving] = useState<KnownWall | null>(null);

  return (
    <View
      name="waende"
      type={walls.length ? "list" : "state-empty"}
      title={t("walls.title")}
      zone={
        <ActionZone status={walls.length ? t("walls.onDevice", { count: walls.length }) : undefined}>
          <Link className="sb-primary-action" to="/neu">
            <Icon name="plus" />
            <span className="sb-primary-action__label">{t("new.title")}</span>
          </Link>
        </ActionZone>
      }
    >
      {walls.length ? (
        <ul className="sb-list" aria-label={t("walls.title")}>
          {walls.map((wall, index) => {
            const date = fmt.date(lang, wall.visited);
            return (
              <li className="sb-list-row" key={wall.id}>
                <div className="sb-list-row__main">
                  <p className="sb-list-row__title">
                    <Link className="sb-list-row__link" to={`/w/${wall.id}`}>
                      {wall.question}
                    </Link>
                  </p>
                  <p className="sb-list-row__meta">
                    {wall.as === undefined ? t("walls.made", { date }) : t("walls.visitedAs", { date, name: wall.as })}
                  </p>
                </div>
                {/* a row with a menu of its own has no chevron (sebaro's list) */}
                <span className="sb-list-row__trail app-row-tool">
                  <MenuButton
                    id={`app-wall-${index + 1}`}
                    label={t("walls.more", { question: wall.question })}
                    buttonLabel={t("walls.more", { question: wall.question })}
                    className="sb-icon-button"
                    entries={[{ label: t("walls.remove"), danger: true, onPress: () => setRemoving(wall) }]}
                  >
                    <Icon name="more-vertical" />
                  </MenuButton>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="sb-empty">
          <p className="sb-empty__title">{t("walls.emptyTitle")}</p>
          <p className="sb-empty__text">{t("walls.emptyText")}</p>
        </div>
      )}
      <Dialog
        id="app-dlg-wall"
        open={removing !== null}
        title={t("walls.removeTitle")}
        text={t(
          removing !== null && adminTokens[removing.id] !== undefined ? "walls.removeTextAdmin" : "walls.removeText",
          {
            question: removing?.question ?? "",
          },
        )}
        onClose={(value) => {
          const wall = removing;
          setRemoving(null);
          if (value === "confirm" && wall !== null) useWalls.getState().forget(wall.id);
        }}
      >
        <button className="sb-secondary-action" value="cancel" data-sb-dialog-cancel>
          {t("common.cancel")}
        </button>
        <button className="sb-danger-action sb-danger-action--outlined" value="confirm">
          {t("walls.removeConfirm")}
        </button>
      </Dialog>
    </View>
  );
}
