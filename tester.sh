#!/bin/bash
# Test YouPub 1.0.85 : multi-écran (barre d'options) et ⏮⏭ du direct.
set -x
API=$1
centre() { adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1; adb shell cat /sdcard/u.xml | tr '>' '\n' | grep "$1" | grep -o 'bounds="[^"]*"' | head -1 | sed -E 's/bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]"/\1 \2 \3 \4/' | awk '{print int(($1+$3)/2), int(($2+$4)/2)}'; }
cap() { adb shell screencap -p /sdcard/c.png; adb pull /sdcard/c.png "$1-$API.png"; }
adb install -r YouPub.apk || exit 1
adb root && sleep 3 && adb wait-for-device
adb shell "D=/data/data/fr.hadesdray.youpub; mkdir -p \$D/shared_prefs; printf '<?xml version=\"1.0\" encoding=\"utf-8\" standalone=\"yes\" ?>\n<map><boolean name=\"owner\" value=\"true\" /></map>\n' > \$D/shared_prefs/youpub_licence.xml; U=\$(stat -c %u \$D); chown -R \$U:\$U \$D/shared_prefs; chmod 660 \$D/shared_prefs/youpub_licence.xml; restorecon -R \$D/shared_prefs || true"
adb shell dumpsys package fr.hadesdray.youpub | grep versionName > version-$API.txt
adb logcat -c
# 1. Multi-écran
adb shell am start -n fr.hadesdray.youpub/.ui.MultiScreenActivity --ez demo true
sleep 70
cap multi
W=$(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1); X=${W%x*}; Y=${W#*x}
adb shell input tap $((X/3)) $((Y/2)); sleep 1.2
cap multi-barre
sleep 4
cap multi-barre-disparue
adb shell am force-stop fr.hadesdray.youpub
# 2. Direct : cadre du haut
adb shell am start -n fr.hadesdray.youpub/.ui.MainActivity --es chip live
sleep 70
cap direct
P=$(centre 'id/heroPlayer'); echo "cadre: $P" >> version-$API.txt
[ -n "$P" ] && adb shell input tap $P; sleep 1
cap direct-commandes
N=$(centre 'id/exo_next'); echo "suivant: $N" >> version-$API.txt
adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1; adb shell cat /sdcard/u.xml > ui-direct-$API.xml
T1=$(adb shell cat /sdcard/u.xml | grep -o 'heroTitle"[^>]*' | head -1); echo "avant: $T1" >> version-$API.txt
[ -n "$N" ] && adb shell input tap $N
sleep 25
cap direct-apres-suivant
adb shell uiautomator dump /sdcard/u2.xml >/dev/null 2>&1; adb shell cat /sdcard/u2.xml > ui-apres-$API.xml
adb logcat -d | grep -E "FATAL|AndroidRuntime|fr.hadesdray" | head -200 > logcat-$API.txt
exit 0
