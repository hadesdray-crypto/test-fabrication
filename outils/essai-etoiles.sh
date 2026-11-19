#!/bin/bash
# Essai des étoiles sur un direct HLS public (flux d'essai, pas YouTube).
O=$(dirname "$0")
dump() { adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1; adb pull /sdcard/u.xml u.xml >/dev/null 2>&1; }
cap() { adb shell screencap -p /sdcard/s.png; adb pull /sdcard/s.png "$1" >/dev/null; }
etoile() {
  dump; XY=$(python3 $O/trouver.py u.xml etoile $1)
  if [ -z "$XY" ]; then adb shell input tap $CX $CY; sleep 1; dump; XY=$(python3 $O/trouver.py u.xml etoile $1); fi
  echo "etoile $1 -> $XY"; [ -n "$XY" ] && adb shell input tap $XY
}
adb shell settings put secure immersive_mode_confirmations confirmed
W=$(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1); CX=$(( ${W%x*} / 2 )); CY=$(( ${W#*x} / 5 ))
adb shell am start -n fr.hadesdray.youpub/.ui.LiveActivity --es name Essai --esa urls "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
sleep 20
adb shell input tap $CX $CY; sleep 1; cap 5-direct-etoiles.png
etoile 1; sleep 2; cap 6-dossier-favori.png
dump; XY=$(python3 $O/trouver.py u.xml texte "Chaînes"); echo "dossier -> $XY"; [ -n "$XY" ] && adb shell input tap $XY
sleep 2
etoile 3; sleep 8; cap 7-versions-video.png
dump; XY=$(python3 $O/trouver.py u.xml texte "Meilleure"); echo "version -> $XY"; [ -n "$XY" ] && adb shell input tap $XY
sleep 15; cap 8-enregistrement.png
etoile 3; sleep 6; cap 9-arret.png
adb shell am start -n fr.hadesdray.youpub/.ui.LibraryActivity; sleep 5; cap 10-favoris-dossiers.png
dump; XY=$(python3 $O/trouver.py u.xml texte 'text="Chaînes"'); echo "ouvrir -> $XY"; [ -n "$XY" ] && adb shell input tap $XY
sleep 3; cap 11-dossier-chaines.png
