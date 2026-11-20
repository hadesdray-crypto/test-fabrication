#!/bin/bash
# Essai télé 2 : lecteur vidéo de YouPub TV piloté aux flèches (étoiles, globe), retour.
cap() { adb shell screencap -p /sdcard/s.png; adb pull /sdcard/s.png "$1" >/dev/null; }
key() { adb shell input keyevent "KEYCODE_$1"; sleep 1; }
adb install -r ma-maison.apk; adb install -r YouPub-TV.apk
for p in fr.hadesdray.mamaison fr.hadesdray.youpub.tv; do for q in RECORD_AUDIO POST_NOTIFICATIONS; do adb shell pm grant $p android.permission.$q 2>/dev/null; done; done
adb shell am start -n fr.hadesdray.youpub.tv/fr.hadesdray.youpub.ui.VideoActivity --es url "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
sleep 30; cap 1-lecteur-tele.png
key DPAD_CENTER; sleep 1; cap 2-commandes.png
key DPAD_UP; key DPAD_UP; key DPAD_RIGHT; key DPAD_RIGHT; cap 3-etoiles.png
key DPAD_DOWN; key DPAD_DOWN; key DPAD_DOWN; key DPAD_DOWN; cap 4-boutons.png
key BACK; sleep 3; cap 5-retour.png
