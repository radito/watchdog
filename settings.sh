#!/system/bin/sh
# Invoked by the WebUI bridge. Only decimal arguments reach the config file.
MODDIR=${0%/*}
umask 077
. "$MODDIR/watchdog.sh"

case "$1" in
    read)
        cat "$MODDIR/config.sh"
        ;;
    save)
        [ "$#" = 5 ] || exit 1
        INACTIVE_MINUTES=$2 CHECK_INTERVAL=$3 BOOT_GRACE_SECONDS=$4 DRY_RUN=$5
        validate_config || exit 1
        temp=$(mktemp "$MODDIR/.config.XXXXXX") || exit 1
        trap 'rm -f "$temp"' EXIT HUP INT TERM
        printf 'INACTIVE_MINUTES=%s\nCHECK_INTERVAL=%s\nBOOT_GRACE_SECONDS=%s\nDRY_RUN=%s\n' \
            "$INACTIVE_MINUTES" "$CHECK_INTERVAL" "$BOOT_GRACE_SECONDS" "$DRY_RUN" > "$temp" || exit 1
        chmod 600 "$temp" || exit 1
        mv -f "$temp" "$MODDIR/config.sh" || exit 1
        ;;
    *) exit 1 ;;
esac
