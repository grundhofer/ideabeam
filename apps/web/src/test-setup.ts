// What every unit test needs: a clean start after each test, and the browser parts that jsdom lacks. jsdom knows
// neither CSS nor <dialog> nor popover: what depends on them is checked in a real browser (tests/).
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import i18n from "./i18n";
import { useWall } from "./store/wall";
import { useWalls } from "./store/walls";
import { useToast } from "./store/toast";

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("de");
  localStorage.clear();
  useWall.getState().leave();
  useWalls.setState(useWalls.getInitialState());
  useToast.setState(useToast.getInitialState());
});

window.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia ??= (query: string) => ({ matches: false, media: query }) as MediaQueryList;
HTMLElement.prototype.hidePopover ??= () => {};
