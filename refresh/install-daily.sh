#!/bin/zsh
# Sets up a daily refresh on your Mac (07:30 every day; if the Mac is asleep it runs when it wakes).
# Usage:  cd into the kit folder, then:  zsh refresh/install-daily.sh
set -e
KIT="$(cd "$(dirname "$0")/.." && pwd)"

case "$KIT" in
  */Downloads/*|*/Documents/*|*/Desktop/*)
    echo "This folder is inside Downloads, Documents or Desktop, which macOS does not let background jobs use."
    echo "Drag the cricket-site-kit folder to your home folder (the one with your name) in Finder,"
    echo "then run zsh refresh/install-daily.sh again from there."
    exit 1;;
esac

if ! command -v node >/dev/null 2>&1; then echo "Node.js was not found. Install it from nodejs.org first."; exit 1; fi
NODE_DIR="$(dirname "$(command -v node)")"
LABEL="com.cricket-site.refresh"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string><string>-c</string>
    <string>cd "$KIT" &amp;&amp; PATH="$NODE_DIR:/usr/bin:/bin:/usr/sbin:/sbin" npm run refresh &gt;&gt; refresh/refresh.log 2&gt;&amp;1</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>30</integer></dict>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Done. The site will refresh every day at 07:30. Log: $KIT/refresh/refresh.log"
echo "To stop it later:  zsh refresh/uninstall-daily.sh"
