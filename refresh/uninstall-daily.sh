#!/bin/zsh
LABEL="com.cricket-site.refresh"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "Daily refresh removed."
