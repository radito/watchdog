# watchdog

A KernelSU module that reboots your phone after a set duration of screen-off
inactivity. Default: **6 hours**.

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

1. Download `watchdog-1.3.0.zip` from [Releases](https://github.com/radito/watchdog/releases/latest).
2. Install it in **KernelSU Manager → Modules**, then reboot.
3. Open the module's **WebUI**, adjust your settings on **Home**, and tap **Save**.

## Settings

| Setting | What it does | Default |
| --- | --- | --- |
| Inactivity duration | Screen-off time before rebooting. | 6 hours |
| Check every | How often the phone's screen state is checked. | 60 seconds |
| Boot delay | Wait before monitoring after boot completes. | 5 minutes |
| Dry run | Log when a reboot would happen, without rebooting. | Off |

Saving applies changes at the next check and resets the countdown. Boot delay
changes apply on the next boot. Updating or reinstalling may reset your settings.

**Preview** simulates the countdown at 360× speed; it never reboots your phone.
Use the sun/moon toggle to switch between light and dark mode.

## Logs and stopping

Enable **Dry run** and save to check behavior before allowing reboots. Logs:
`/data/adb/modules/inactivity_reboot/watchdog.log`.

Disable or remove the module in KernelSU Manager to stop it. Re-enabling requires
a reboot.

## Build and browser preview

Requires **Node.js 24 or newer**.

```sh
npm ci
npm run dev
```

Open [localhost:5173](http://127.0.0.1:5173) to try the UI. Browser changes do not
control your phone; save device settings in KernelSU Manager.

Run `npm run module` to build the installable ZIP in `dist/`.
