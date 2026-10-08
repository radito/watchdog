# watchdog

A minimal KernelSU module by **radito** that requests a normal Android reboot after a set
duration of screen-off inactivity. Default: **6 hours**, checked every **60 seconds**,
starting **5 minutes after boot completes**.

## Why reboot? AFU, BFU, and data access

Rebooting can return an unattended phone to **Before First Unlock (BFU)**,
reducing the private data available to the running operating system until you
enter your lock-screen credential again. This rationale assumes working Android
file-based encryption and a PIN, password, or pattern protecting the device.

| State | Meaning | Access to private app data |
| --- | --- | --- |
| **BFU (Before First Unlock)** | The phone has booted, but you have not yet unlocked it with your credential. | Credential-encrypted (CE) storage is locked. Device-encrypted (DE) storage remains available for Direct Boot features. |
| **AFU (After First Unlock)** | You have unlocked the phone at least once since boot. | CE storage is available to the unlocked user profile, including after the screen locks again. |

Android separates CE and DE storage. Locking the screen again normally leaves
CE storage accessible to the operating system; a restart makes another initial
unlock necessary. This does **not** mean AFU files become unencrypted on disk.
See [Android file-based encryption](https://source.android.com/docs/security/features/encryption/file-based)
and [Direct Boot storage behavior](https://developer.android.com/privacy-and-security/direct-boot).

The security goal is to shorten the time a lost, seized, or unattended phone
remains in AFU. If an attacker bypasses operating-system access controls while
CE storage is available, more private data may be exposed. Returning to BFU can
reduce that exposure, but does not guarantee resistance to forensic tools or
device-specific exploits. Automatic reboot is also used to put data at rest in
[GrapheneOS](https://grapheneos.org/features#auto-reboot).

### Limits of this module

- It measures **screen-off time**, not time since the last successful unlock,
  and does not check whether the phone is already in BFU. Screen wakes reset the
  countdown; notifications or someone repeatedly waking the phone can postpone
  reboot. It can also reboot again while already in BFU.
- Deep sleep can delay the reboot. The configured duration is not an enforced
  security deadline.
- It runs as a KernelSU shell service. An attacker with sufficient root or
  system control can disable it. It does not restore Verified Boot protections
  changed by rooting or an unlocked bootloader, erase data, or undo an existing
  compromise. BFU still exposes DE storage and Direct Boot services.
- Reboot interrupts running work. Apps needing CE storage may stop delivering
  notifications or doing background tasks until you unlock again. Direct
  Boot-aware services can continue operating.

## Install

1. Run `npm ci` and `npm run module` to create `dist/watchdog-1.3.0.zip`.
2. Install the ZIP from KernelSU Manager's Modules page, then reboot.
3. Open the module WebUI in KernelSU Manager, change settings, and tap Save.
   The running service applies changes at its next check and resets the idle timer.
   Boot delay changes apply on the next boot. No module rebuild is needed.
   Settings inside the module may be replaced by reinstalling or updating it.

## Settings page and browser preview

The interface uses Vue 3 and [miuix-vue](https://github.com/YuKongA/miuix-vue)
for MIUIX cards, buttons, switches, and sliders. Font sizes and spacing match the
[MIUIX demo](https://yukonga.github.io/miuix-vue/). MiSans VF loads from the same
Xiaomi CDN as that demo; no font files are bundled. When offline, system fonts
provide a fallback. The sun/moon toggle selects light or dark mode and remembers
your choice; before a choice is saved, the page follows the system theme.
Use **Node.js 24 or newer** (also recorded in `.node-version`).

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Set the duration, polling interval, boot delay, and
dry-run mode on **Home**. Use the bottom navigation to open **Preview**.
The interactive countdown simulates screen-off time at 360× speed;
use the slider to jump ahead or turn the simulated screen on to reset it.
It never controls or reboots a connected phone. Switching back to Home pauses
the simulation and keeps its position; changing settings resets the preview.

The browser page is a settings and countdown preview. On the phone, open the
installed module's **WebUI** in KernelSU Manager to read and save its actual
configuration. Changes apply at the next polling check, including to a service
that is already running; no export, module rebuild, or phone reboot is required.
Each configuration change resets the countdown. Boot delay applies on next boot.

The interface uses the official [KernelSU WebUI API](https://kernelsu.org/guide/module-webui.html).
If device settings cannot be read, saving is blocked until loading succeeds.

`npm run build` compiles the page into `webroot/`, which is included in the
module ZIP. `npm run preview` serves the compiled page locally. The installed
WebUI settings and controls work offline, using a system font fallback; npm and
Node.js are only needed on your development computer.

Example: reboot after 2 hours of inactivity:

```sh
INACTIVE_MINUTES=120
CHECK_INTERVAL=60
BOOT_GRACE_SECONDS=300
DRY_RUN=0
```

`INACTIVE_MINUTES`: 1–43200. `CHECK_INTERVAL`: 5–3600 seconds.
`BOOT_GRACE_SECONDS`: 0–86400. `DRY_RUN`: 0 or 1. Use whole decimal numbers
without leading zeroes. Invalid settings stop the service.

## What counts as inactive?

Android must report `Asleep` or `Dozing` in `dumpsys power`; dozing includes
always-on display. `Awake`, `Dreaming`, or an unreadable power state reset the
countdown. A changed last-wake timestamp also resets it, catching screen wakes
that happen between polls. The timer starts at the first idle observation,
starts fresh after every boot, and is checked again immediately before reboot.

This measures screen inactivity. It does **not** detect ongoing calls, music,
downloads, or other work with the screen off. Any screen wake, including a
notification, restarts the timer. ROMs that do not expose the expected fields
will not trigger a reboot.

The service uses no wake lock or exact alarm. Deep sleep can delay polling and
reboot until the CPU wakes naturally; this is a duration threshold, not a precise
alarm. Suspend time counts toward the duration; changing the clock does not.

## Check behavior or stop

Enable **Dry run** in the installed WebUI and save to log when a reboot would
occur. You can also edit the installed `config.sh`; the service reloads it at the
next check. Logs are at
`/data/adb/modules/inactivity_reboot/watchdog.log`, with one rotated backup.

Disable or remove the module in KernelSU Manager. The running service exits on
its next check. Re-enabling requires a reboot. The module requests a graceful
reboot via `svc power reboot` and stops if that request returns.