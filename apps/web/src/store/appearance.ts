// appearance.ts: the chosen theme, tone and motion setting. The values live on <html> and in localStorage
// (lib/appearance.ts); the store lets the views follow them.
import { create } from "zustand";
import { readSetting, writeSetting, type Theme, type Tone } from "../lib/appearance";

type Appearance = {
  theme: Theme;
  tone: Tone;
  reduceMotion: boolean;
  setTheme(theme: Theme): void;
  setTone(tone: Tone): void;
  setReduceMotion(on: boolean): void;
};

const themeNow = (): Theme => {
  const set = readSetting("theme");
  return set === "light" || set === "dark" ? set : "system";
};

export const useAppearance = create<Appearance>()((set) => ({
  theme: themeNow(),
  tone: readSetting("tone") === "warm" ? "warm" : "cool",
  reduceMotion: readSetting("motion") === "reduce",
  setTheme(theme) {
    writeSetting("theme", theme === "system" ? null : theme);
    set({ theme });
  },
  setTone(tone) {
    writeSetting("tone", tone === "warm" ? "warm" : null);
    set({ tone });
  },
  setReduceMotion(on) {
    writeSetting("motion", on ? "reduce" : null);
    set({ reduceMotion: on });
  },
}));

// „Hell oder Dunkel“ in the site's head is the copy's theme-button.js: it sets the attribute and the stored key
// itself and says so with this event. The store follows, so the command palette shows the same choice.
document.addEventListener("sb-theme-change", () => useAppearance.setState({ theme: themeNow() }));
