#!/system/bin/sh

valid_number() {
    case "$1" in ''|*[!0-9]*) return 1 ;; esac
    # Disallow leading zeroes (shell arithmetic may interpret these as octal).
    case "$1" in 0) ;; 0*) return 1 ;; esac
    [ "${#1}" -le 8 ] && [ "$1" -ge "$2" ] && [ "$1" -le "$3" ]
}

validate_config() {
    valid_number "$INACTIVE_MINUTES" 1 43200 &&
        valid_number "$CHECK_INTERVAL" 5 3600 &&
        valid_number "$BOOT_GRACE_SECONDS" 0 86400 &&
        valid_number "$DRY_RUN" 0 1
}

# Read one complete snapshot (the WebUI replaces config.sh atomically).
# Never execute config contents: only the four validated decimal settings are accepted.
reload_config() {
    config_values=$(awk '
        /^[[:space:]]*(#.*)?$/ { next }
        /^INACTIVE_MINUTES=[0-9]+$/ { split($0, a, "="); idle=a[2]; ni++; next }
        /^CHECK_INTERVAL=[0-9]+$/ { split($0, a, "="); interval=a[2]; nc++; next }
        /^BOOT_GRACE_SECONDS=[0-9]+$/ { split($0, a, "="); grace=a[2]; nb++; next }
        /^DRY_RUN=[0-9]+$/ { split($0, a, "="); dry=a[2]; nd++; next }
        { bad=1 }
        END {
            if (bad || ni != 1 || nc != 1 || nb != 1 || nd != 1) exit 1
            print idle " " interval " " grace " " dry
        }
    ' "$1") || return 1
    # Word splitting is intentional; awk emits only four decimal numbers.
    set -- $config_values
    INACTIVE_MINUTES=$1 CHECK_INTERVAL=$2 BOOT_GRACE_SECONDS=$3 DRY_RUN=$4
    validate_config || return 1
    next_settings="$INACTIVE_MINUTES:$CHECK_INTERVAL:$BOOT_GRACE_SECONDS:$DRY_RUN"
    config_changed=0
    if [ "$next_settings" != "$active_settings" ]; then
        active_settings=$next_settings
        config_changed=1
        reset_idle
    fi
}

# Input: dumpsys power text. Output: wakefulness|last-wake timestamp.
# Take only the fixed timestamp: newer Android adds a changing "ms ago" suffix.
parse_power() {
    awk '
        /^[[:space:]]*mWakefulness=/ && !have_state {
            split($0, parts, "="); split(parts[2], words, /[[:space:]]+/)
            state = words[1]; have_state = 1
        }
        /^[[:space:]]*mLastWakeTime=/ && !have_wake {
            split($0, parts, "="); split(parts[2], words, /[[:space:]]+/)
            wake = words[1]; have_wake = 1
        }
        END {
            if (have_state && have_wake && wake ~ /^[0-9]+$/)
                print state "|" wake
        }
    '
}

reset_idle() {
    idle_since=
    last_wake=
}

# Returns success only when an uninterrupted observed idle period has elapsed.
# Call again with a fresh power snapshot immediately before requesting reboot.
idle_due() {
    sample=$1
    now=$2
    case "$sample" in
        Asleep\|*|Dozing\|*) ;;
        *) reset_idle; return 1 ;;
    esac
    wake=${sample#*|}
    case "$wake" in ''|*[!0-9]*) reset_idle; return 1 ;; esac
    if [ -z "$idle_since" ] || [ "$wake" != "$last_wake" ] || [ "$now" -lt "$idle_since" ]; then
        idle_since=$now
        last_wake=$wake
    fi
    [ "$((now - idle_since))" -ge "$((INACTIVE_MINUTES * 60))" ]
}
