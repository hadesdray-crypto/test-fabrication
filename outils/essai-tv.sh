#!/bin/bash
# Essai télé 3 : Ma Maison seule installe YouPub TV d'elle-même.
cap() { adb shell screencap -p /sdcard/s.png; adb pull /sdcard/s.png "$1" >/dev/null; }
key() { adb shell input keyevent "KEYCODE_$1"; sleep 1; }
adb install -r ma-maison.apk
adb shell pm grant fr.hadesdray.mamaison android.permission.RECORD_AUDIO 2>/dev/null
adb shell appops set fr.hadesdray.mamaison REQUEST_INSTALL_PACKAGES allow
adb shell monkey -p fr.hadesdray.mamaison -c android.intent.category.LEANBACK_LAUNCHER 1 >/dev/null; sleep 8; cap 1-ma-maison.png
sleep 40; cap 2-installation.png
adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1; adb pull /sdcard/u.xml u.xml >/dev/null 2>&1
grep -o 'text="[^"]*"' u.xml | head -20
XY=$(python3 outils/trouver.py u.xml texte 'text="Install"'); [ -z "$XY" ] && XY=$(python3 outils/trouver.py u.xml texte 'text="INSTALL"')
echo "installer -> $XY"; [ -n "$XY" ] && adb shell input tap $XY
sleep 25; cap 3-apres.png
adb shell pm list packages | grep hadesdray
adb shell dumpsys package fr.hadesdray.youpub.tv | grep -i "installer\|versionName\|initiat\|originat"
adb shell am force-stop fr.hadesdray.mamaison
adb shell monkey -p fr.hadesdray.mamaison -c android.intent.category.LEANBACK_LAUNCHER 1 >/dev/null; sleep 8
adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1; adb pull /sdcard/u.xml u.xml >/dev/null 2>&1; grep -q "PLUS TARD" u.xml && { XY=$(python3 outils/trouver.py u.xml texte 'text="PLUS TARD"'); echo "fenetre maj -> $XY"; adb shell input tap $XY; sleep 2; }
for n in $(seq 1 25); do adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1; adb pull /sdcard/u.xml u.xml >/dev/null 2>&1; K=$(python3 outils/focus.py u.xml YouPub); [ "$K" = "ok" ] && break; [ "$K" = "absent" ] && K=DPAD_DOWN; adb shell input keyevent KEYCODE_$K; sleep 1; done
cap 4-tuile.png
adb shell input keyevent KEYCODE_DPAD_CENTER; sleep 15; cap 5-youpub-tv.png
adb shell input keyevent KEYCODE_DPAD_DOWN; sleep 1; adb shell input keyevent KEYCODE_DPAD_RIGHT; sleep 1; cap 6-fleches.png
adb shell input keyevent KEYCODE_BACK; sleep 4; cap 7-retour.png
