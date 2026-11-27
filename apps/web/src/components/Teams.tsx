// Teams.tsx: „Teams“ under „Mehr“, the moderation's map of the teams in a step of pairs or small groups (stage M4,
// PLAN-METHODEN.md 4). Every team by its number, with its members' names: what the moderation needs to fill the
// breakout rooms of its video tool, room by room. The app formed the teams at random (the owner's decision 4); the
// moderation may swap two people: „Tauschen“ at the first, then „Mit <name> tauschen“ at the second, keys alone, no
// dragging. The swap goes to the wall whole (`admin.teams.set`, store/wall.ts) and shows once the wall has said so;
// whoever moved keeps what they read, and reads their new team's notes from then on (packages/shared, domain/teams.ts).
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { swapped, type Participant, type TeamView } from "@ideabeam/shared";
import { Dialog } from "../sebaro/react/Dialog";

type Props = {
  open: boolean;
  teams: TeamView;
  participants: Participant[];
  /** this browser's person */
  you: string | null;
  /** the teams with two people swapped, whole */
  onSwap(teams: string[][]): void;
  onClose(): void;
};

export function TeamsDialog({ open, teams, participants, you, onSwap, onClose }: Props) {
  const { t } = useTranslation();
  // the first person of a swap, while the second is chosen
  const [first, setFirst] = useState<string | null>(null);
  const names = new Map(participants.map((person) => [person.id, person.name]));
  const nameOf = (id: string) => names.get(id) ?? t("wall.teams.gone");
  const map = teams.members.map((team) => team ?? []);
  const teamOf = (id: string) => map.findIndex((team) => team.includes(id));
  const firstName = first === null ? null : nameOf(first);
  // After a swap the pressed key stands in another team's list, a new element: the focus goes to it once the wall
  // has said so (the teams' revision moves), so the keys stay where the person works.
  const refocus = useRef<string | null>(null);
  useEffect(() => {
    const id = refocus.current;
    if (id === null) return;
    refocus.current = null;
    document.querySelector<HTMLElement>(`#app-dlg-teams [data-person="${id}"]`)?.focus();
  }, [teams.rev]);

  return (
    <Dialog
      id="app-dlg-teams"
      open={open}
      title={t("wall.teams.title")}
      text={t(first === null ? "wall.teams.text" : "wall.teams.choosing", { name: firstName })}
      body={
        <div className="app-teams">
          {map.map((team, at) => (
            <section key={at} className="app-teams__team" aria-labelledby={`app-team-${at + 1}`}>
              <h3 className="sb-list-header" id={`app-team-${at + 1}`}>
                {t("wall.teams.team", { n: at + 1 })} <span className="sb-list-header__count">{team.length}</span>
              </h3>
              <ul className="sb-list" aria-labelledby={`app-team-${at + 1}`}>
                {team.map((id) => {
                  const picked = first === id;
                  // a swap within the same team changes nothing: no key for it
                  const offered = first === null || picked || teamOf(first) !== at;
                  return (
                    <li key={id} className="sb-list-row">
                      <div className="sb-list-row__main">
                        <p className="sb-list-row__title">
                          {nameOf(id)}
                          {id === you && <> {t("wall.you")}</>}
                        </p>
                      </div>
                      {offered && (
                        <span className="sb-list-row__trail">
                          <button
                            type="button"
                            className="sb-text-action"
                            data-person={id}
                            aria-pressed={first === null || picked ? picked : undefined}
                            onClick={() => {
                              if (first === null) return setFirst(id);
                              if (picked) return setFirst(null);
                              refocus.current = id;
                              onSwap(swapped(map, first, id));
                              setFirst(null);
                            }}
                          >
                            {first === null || picked
                              ? t("wall.teams.swap", { name: nameOf(id) })
                              : t("wall.teams.swapWith", { name: nameOf(id), first: firstName })}
                          </button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      }
      onClose={() => {
        setFirst(null);
        onClose();
      }}
    >
      <button className="sb-secondary-action" value="close">
        {t("common.close")}
      </button>
    </Dialog>
  );
}
