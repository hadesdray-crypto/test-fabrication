#!/bin/bash
# Essai 1.0.117 : bijou globe (traduction) sur l'image et sa fenêtre de choix.
O=$(dirname "$0")
cap() { adb shell screencap -p /sdcard/s.png; adb pull /sdcard/s.png "$1" >/dev/null; }
dump() { rm -f u.xml; adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1; adb pull /sdcard/u.xml u.xml >/dev/null 2>&1; }
find() { dump; python3 $O/trouver.py u.xml texte "$1" 2>/dev/null; }
W=$(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1); LW=${W%x*}
adb shell am start -n fr.hadesdray.youpub/.ui.VideoActivity --es url "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
sleep 25
adb shell input tap $((LW/2)) 200; sleep 0.5; cap 5-globe.png
XY=""; for n in 1 2 3 4 5 6; do XY=$(find 'text="Traduire"'); [ -n "$XY" ] && break; R=$(find 'Enchaîner'); Y=${R#* }; [ -n "$Y" ] && adb shell input swipe 700 $Y 200 $Y 500; sleep 2; done
echo "traduire -> $XY"; [ -n "$XY" ] && adb shell input tap $XY; sleep 2; cap 6-menu.png
XY=$(find 'Sous-titres de la vidéo : '); echo "piste -> $XY"; [ -n "$XY" ] && adb shell input tap $XY
sleep 8; cap 7-piste.png
adb shell input tap $((LW/2)) 200; sleep 0.5; cap 8-globe-allume.png
