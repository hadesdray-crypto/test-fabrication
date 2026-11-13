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
F=$(centre "content-desc=\"Format de l'image\""); echo "format: $F" >> version-$API.txt
[ -n "$F" ] && adb shell input tap $F; sleep 1.5
cap multi-format2
F=$(centre "content-desc=\"Format de l'image\""); [ -n "$F" ] && adb shell input tap $F; sleep 1.5
cap multi-format3
G=$(centre 'content-desc="Niveau du son"'); echo "jauge: $G" >> version-$API.txt
if [ -n "$G" ]; then set -- $G; adb shell input tap $1 $(( $2 + 40 )); fi; sleep 0.8
cap multi-jauge
# 3. ＋ Chaîne → catégorie Enfants
adb shell am start -n fr.hadesdray.youpub/.ui.MultiScreenActivity
sleep 25
adb shell input swipe $((X/3)) $((Y/2)) $((X/3)) $((Y/2)) 1500; sleep 2
C=$(centre 'Changer de cha'); echo "changer: $C" >> version-$API.txt
[ -n "$C" ] && adb shell input tap $C; sleep 3
cap choix
E=$(centre 'content-desc="Catégorie Enfants"'); echo "enfants: $E" >> version-$API.txt
[ -n "$E" ] && adb shell input tap $E; sleep 60
cap enfants
CA=$(centre 'content-desc="Catégorie Canada"'); [ -n "$CA" ] && adb shell input tap $CA; sleep 50
cap canada
adb logcat -d | grep -E "FATAL|AndroidRuntime|fr.hadesdray" | head -200 > logcat-$API.txt
exit 0
