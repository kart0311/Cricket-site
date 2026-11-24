#!/bin/zsh
# Sets up the hourly live update on your Mac. Every hour it checks whether a Test is on; if not it does nothing.
# Usage:  cd into the kit folder, then:  zsh refresh/install-live.sh
set -e
KIT="$(cd "$(dirname "$0")/.." && pwd)"

case "$KIT" in
  */Downloads/*|*/Documents/*|*/Desktop/*)
    echo "This folder is inside Downloads, Documents or Desktop, which macOS does not let background jobs use."
    echo "Drag the cricket-site-kit folder to your home folder (the one with your name) in Finder,"
    echo "then run zsh refresh/install-live.sh again from there."
    exit 1;;
esac

if ! command -v node >/dev/null 2>&1; then echo "Node.js was not found. Install it from nodejs.org first."; exit 1; fi
NODE_DIR="$(dirname "$(command -v node)")"
LABEL="com.cricket-site.live"
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
    <string>cd "$KIT" &amp;&amp; PATH="$NODE_DIR:/usr/bin:/bin:/usr/sbin:/sbin" npm run live &gt;&gt; refresh/live.log 2&gt;&amp;1</string>
  </array>
  <key>StartInterval</key><integer>3600</integer>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Done. The live update will run every hour (it only does work while a Test is on). Log: $KIT/refresh/live.log"
echo "To stop it later:  zsh refresh/uninstall-live.sh"
