ui_print '- Reboot after screen-off inactivity (default: 6 hours)'
ui_print '- Edit config.sh to change timing or enable DRY_RUN'
ui_print '- Open the module WebUI for settings and a countdown preview'
set_perm "$MODPATH/service.sh" 0 0 0755
set_perm "$MODPATH/watchdog.sh" 0 0 0644
set_perm "$MODPATH/config.sh" 0 0 0600
