#!/bin/bash
# Essai télé (Android TV) : Ma Maison sur l'accueil, télécommande jusqu'à la tuile YouPub, ouverture de YouPub TV, retour.
O=$(dirname "$0")
cap() { adb shell screencap -p /sdcard/s.png; adb pull /sdcard/s.png "$1" >/dev/null; }
dump() { rm -f u.xml; adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1; adb pull /sdcard/u.xml u.xml >/dev/null 2>&1; }
key() { adb shell input keyevent "KEYCODE_$1"; sleep 1; }
adb install -r ma-maison.apk; adb install -r YouPub-TV.apk
adb shell pm list packages | grep hadesdray
for p in fr.hadesdray.mamaison fr.hadesdray.youpub.tv; do for q in RECORD_AUDIO POST_NOTIFICATIONS; do adb shell pm grant $p android.permission.$q 2>/dev/null; done; done
adb shell wm size
key HOME; sleep 6; cap 1-accueil-tele.png
adb shell monkey -p fr.hadesdray.mamaison -c android.intent.category.LEANBACK_LAUNCHER 1; sleep 10; cap 2-ma-maison.png
key DPAD_DOWN; cap 3-cadre.png
for n in $(seq 1 25); do dump; K=$(python3 $O/focus.py u.xml YouPub); echo "pas $n : $K"; [ "$K" = "ok" ] && break; [ "$K" = "absent" ] && { key DPAD_DOWN; continue; }; adb shell input keyevent KEYCODE_$K; sleep 1; done
cap 4-tuile-youpub.png
key DPAD_CENTER; sleep 14; cap 5-youpub-tv.png
key DPAD_DOWN; key DPAD_DOWN; key DPAD_RIGHT; cap 6-youpub-fleches.png
key DPAD_CENTER; sleep 8; cap 7-youpub-tuile.png
key BACK; sleep 2; key BACK; sleep 2; key BACK; sleep 3; cap 8-retour.png
adb shell dumpsys activity activities | grep -m3 "mResumedActivity\|topResumedActivity"
