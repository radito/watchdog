import { setThemeMode } from "miuix-vue";

const themeKey = "watchdog.theme.v1";

export function initializeTheme() {
  let mode = "system";
  try {
    const saved = localStorage.getItem(themeKey);
    if (saved === "light" || saved === "dark") mode = saved;
  } catch {
    /* Use system appearance if storage is unavailable. */
  }
  setThemeMode(mode);
}

export function toggleDarkMode(enabled) {
  const mode = enabled ? "dark" : "light";
  setThemeMode(mode);
  try {
    localStorage.setItem(themeKey, mode);
  } catch {
    /* The selected appearance still applies to this session. */
  }
}
