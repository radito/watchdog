#!/system/bin/sh
MODDIR=${0%/*}
umask 077
. "$MODDIR/watchdog.sh"
active_settings=

log_event() {
    # Keep one previous log, bounded to about 32 KiB per file.
    if [ -f "$MODDIR/watchdog.log" ] && [ "$(wc -c < "$MODDIR/watchdog.log")" -gt 32768 ]; then
        mv -f "$MODDIR/watchdog.log" "$MODDIR/watchdog.log.1"
    fi
    printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$MODDIR/watchdog.log"
}

module_enabled() {
    [ -d "$MODDIR" ] && [ ! -e "$MODDIR/disable" ] && [ ! -e "$MODDIR/remove" ]
}

uptime_seconds() {
    # /proc/uptime includes suspend; wall-clock or timezone changes cannot expire the timer.
    read -r elapsed unused < /proc/uptime
    printf '%s\n' "${elapsed%%.*}"
}

power_sample() {
    # Android's own timeout also bounds a hung power service query.
    snapshot=$(/system/bin/dumpsys -t 5 power 2>/dev/null) || return 1
    printf '%s\n' "$snapshot" | parse_power
}

refresh_settings() {
    if ! reload_config "$MODDIR/config.sh"; then
        log_event 'Invalid config.sh; monitoring stopped.'
        exit 1
    fi
    if [ "$config_changed" = 1 ]; then
        log_event "Settings reloaded: idle=${INACTIVE_MINUTES}min, interval=${CHECK_INTERVAL}s, dry_run=$DRY_RUN; countdown reset."
    fi
}

if ! reload_config "$MODDIR/config.sh"; then
    log_event 'Invalid config.sh; monitoring stopped.'
    exit 1
fi

# service.sh runs during late_start; wait for the framework to finish booting.
while module_enabled && [ "$(/system/bin/getprop sys.boot_completed)" != 1 ]; do
    sleep 5
done
module_enabled || exit 0
sleep "$BOOT_GRACE_SECONDS"
module_enabled || exit 0
log_event "Started: idle=${INACTIVE_MINUTES}min, interval=${CHECK_INTERVAL}s, dry_run=$DRY_RUN"
reset_idle
unknown_logged=0

while module_enabled; do
    refresh_settings
    sample=$(power_sample)
    if [ -z "$sample" ]; then
        if [ "$unknown_logged" = 0 ]; then
            log_event 'Power state unavailable; idle countdown reset.'
            unknown_logged=1
        fi
    else
        unknown_logged=0
    fi
    if idle_due "$sample" "$(uptime_seconds)"; then
        # A wake between the last poll and this check cancels the reboot.
        sample=$(power_sample)
        refresh_settings
        if module_enabled && idle_due "$sample" "$(uptime_seconds)"; then
            if [ "$DRY_RUN" = 1 ]; then
                log_event "DRY RUN: would reboot after ${INACTIVE_MINUTES}min idle."
                reset_idle
            else
                log_event "Requesting reboot after ${INACTIVE_MINUTES}min idle."
                /system/bin/svc power reboot >> "$MODDIR/watchdog.log" 2>&1
                # Never fall back to a forced reboot or repeat a failed request.
                log_event 'Reboot command returned; monitoring stopped.'
                exit 1
            fi
        fi
    fi
    sleep "$CHECK_INTERVAL"
done
log_event 'Module disabled or removed; monitoring stopped.'
