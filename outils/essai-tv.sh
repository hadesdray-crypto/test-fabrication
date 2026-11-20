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
