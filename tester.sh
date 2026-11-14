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
# Multi-écran 1.0.93 : seulement ce qui a changé
adb shell am start -n fr.hadesdray.youpub/.ui.MultiScreenActivity --ez demo true
sleep 75
W=$(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1); X=${W%x*}; Y=${W#*x}
CX=$((X/3)); CY=$((Y/2))
adb shell input tap $CX $CY; sleep 1.2
cap 1-barre
G=$(centre 'content-desc="Niveau du son"'); echo "jauge: $G" >> version-$API.txt
if [ -n "$G" ]; then set -- $G; adb shell input swipe $1 $2 $1 $(( $2 + 120 )) 400; fi; sleep 0.6
cap 2-jauge-baissee
sleep 4
D=$(centre 'text="Disposition"'); echo "disposition: $D" >> version-$API.txt
[ -n "$D" ] && adb shell input tap $D; sleep 1.5
cap 3-dispositions
I=$(centre 'Petites incrust'); [ -n "$I" ] && adb shell input tap $I; sleep 2.5
cap 4-incrustee
D=$(centre 'text="Disposition"'); [ -n "$D" ] && adb shell input tap $D; sleep 1.5
C=$(centre 'Enlever les contours'); echo "contours: $C" >> version-$API.txt; [ -n "$C" ] && adb shell input tap $C; sleep 1.5
D=$(centre 'text="Disposition"'); [ -n "$D" ] && adb shell input tap $D; sleep 1.5
I=$(centre 'te à c'); [ -n "$I" ] && adb shell input tap $I; sleep 2.5
cap 5-cote-a-cote-sans-contours
adb shell "input tap $CX $CY & sleep 0.12; input tap $CX $CY"; sleep 2
cap 6-double-appui
adb shell dumpsys window | grep -c "mCurrentFocus" >/dev/null
F=$(centre 'text="Disposition"'); echo "apres double appui, barre du haut visible: [$F]" >> version-$API.txt
if [ -n "$F" ]; then adb shell input tap $CX $CY; sleep 1; A=$(centre 'content-desc="Agrandir"'); [ -n "$A" ] && adb shell input tap $A; sleep 2; cap 6b-agrandir; fi
F=$(centre 'text="Disposition"'); echo "plein ecran, barre du haut visible: [$F]" >> version-$API.txt
adb shell input swipe $((X/5)) $CY $((X*4/5)) $CY 120; sleep 2
cap 7-apres-glissement
F=$(centre 'text="Disposition"'); echo "apres glissement, barre du haut visible: [$F]" >> version-$API.txt
B=$(centre 'text="Diffuser"'); echo "diffuser: $B" >> version-$API.txt; [ -n "$B" ] && adb shell input tap $B; sleep 1.5
cap 8-diffuser
adb shell input keyevent 4; sleep 1
R=$(centre 'Enregistrer la cha'); echo "enregistrer: $R" >> version-$API.txt; [ -n "$R" ] && adb shell input tap $R; sleep 9
cap 9-enregistrement
R=$(centre 'Enregistrer la cha'); [ -n "$R" ] && adb shell input tap $R; sleep 6
cap 10-apres-arret
adb logcat -d | grep -E "FATAL|AndroidRuntime|fr.hadesdray" | head -200 > logcat-$API.txt
exit 0
