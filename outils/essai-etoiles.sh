#!/bin/bash
# Essai 1.0.113 : bouton Traduire sur une vidéo anglaise.
O=$(dirname "$0")
cap() { adb shell screencap -p /sdcard/s.png; adb pull /sdcard/s.png "$1" >/dev/null; }
dump() { rm -f u.xml; adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1; adb pull /sdcard/u.xml u.xml >/dev/null 2>&1; }
find() { dump; python3 $O/trouver.py u.xml texte "$1" 2>/dev/null; }
adb shell settings put secure immersive_mode_confirmations confirmed
adb shell am start -n fr.hadesdray.youpub/.ui.VideoActivity --es url "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
sleep 25; cap 5-lecteur.png
R=$(find 'Enchaîner'); Y=${R#* }; echo "rangée $R"
XY=""; for n in 1 2 3 4 5 6; do
  XY=$(find 'text="Traduire"'); [ -n "$XY" ] && break
  [ -n "$Y" ] && adb shell input swipe 700 $Y 200 $Y 500; sleep 2
done
echo "traduire -> $XY"; [ -n "$XY" ] && adb shell input tap $XY; sleep 2; cap 6-traduire.png
XY=$(find 'text="Sous-titres en français"'); echo "choix -> $XY"; [ -n "$XY" ] && adb shell input tap $XY
sleep 1; cap 6b-message.png; sleep 12; cap 7-sous-titres.png; sleep 15; cap 8-sous-titres.png
sleep 45; cap 9-sous-titres.png; sleep 30; cap 10-sous-titres.png
