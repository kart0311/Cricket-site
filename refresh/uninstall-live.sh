#!/bin/zsh
LABEL="com.cricket-site.live"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "Hourly live update removed."
