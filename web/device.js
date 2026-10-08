import { exec } from "kernelsu";

export const onDevice = typeof window.ksu?.exec === "function";

export async function deviceCommand(argumentsText) {
  const command =
    "ASH_STANDALONE=1 /data/adb/ksu/bin/busybox sh " +
    "/data/adb/modules/inactivity_reboot/settings.sh " +
    argumentsText;
  let timer;
  try {
    const result = await Promise.race([
      exec(command),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error("Device request timed out. Retry loading settings."),
            ),
          10000,
        );
      }),
    ]);
    if (result.errno !== 0)
      throw new Error(
        "Could not access the module settings. Check the module installation.",
      );
    return result.stdout;
  } finally {
    clearTimeout(timer);
  }
}
