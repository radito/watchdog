export const fields = {
  INACTIVE_MINUTES: { min: 1, max: 43200 },
  CHECK_INTERVAL: { min: 5, max: 3600 },
  BOOT_GRACE_SECONDS: { min: 0, max: 86400 },
  DRY_RUN: { min: 0, max: 1 },
};

export function validateSettings(input) {
  const config = {};
  for (const [key, { min, max }] of Object.entries(fields)) {
    const raw = String(input[key]);
    if (!/^(0|[1-9]\d*)$/.test(raw) || Number(raw) < min || Number(raw) > max) {
      throw new Error(
        `${key.replaceAll("_", " ")} must be a whole number from ${min} to ${max}.`,
      );
    }
    config[key] = Number(raw);
  }
  return config;
}

export function parseSettings(text) {
  const result = {};
  for (const line of text.split("\n")) {
    const match = line.trim().match(/^([A-Z_]+)=([0-9]+)$/);
    if (match && Object.hasOwn(fields, match[1])) result[match[1]] = match[2];
  }
  return validateSettings(result);
}

export function formatDuration(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return [hours, minutes, secs]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function simulate(config, idleSeconds, screen) {
  const elapsed = screen === "awake" ? 0 : Math.max(0, idleSeconds);
  const threshold = config.INACTIVE_MINUTES * 60;
  return {
    elapsed,
    remaining: Math.max(0, threshold - elapsed),
    progress: Math.min(1, elapsed / threshold),
    due: elapsed >= threshold,
  };
}
