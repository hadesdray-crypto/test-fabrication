#!/bin/bash
# Essai 1.0.115 : étoiles sur l'image, sous-titres (pastille, réglages), place prise.
O=$(dirname "$0")
cap() { adb shell screencap -p /sdcard/s.png; adb pull /sdcard/s.png "$1" >/dev/null; }
dump() { rm -f u.xml; adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1; adb pull /sdcard/u.xml u.xml >/dev/null 2>&1; }
find() { dump; python3 $O/trouver.py u.xml texte "$1" 2>/dev/null; }
W=$(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1); LW=${W%x*}
adb shell am start -n fr.hadesdray.youpub/.ui.VideoActivity --es url "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
sleep 25
adb shell input tap $((LW/2)) 200; sleep 0.5; cap 5-etoiles-image.png
R=$(find 'Enchaîner'); Y=${R#* }
XY=""; for n in 1 2 3 4 5 6; do XY=$(find 'text="Traduire"'); [ -n "$XY" ] && break; [ -n "$Y" ] && adb shell input swipe 700 $Y 200 $Y 500; sleep 2; done
echo "traduire -> $XY"; [ -n "$XY" ] && adb shell input tap $XY; sleep 2
XY=$(find 'text="Sous-titres en français"'); echo "choix -> $XY"; [ -n "$XY" ] && adb shell input tap $XY
sleep 15; cap 6-sous-titres.png
adb shell input tap $((LW/2)) 200; sleep 0.4
XY=$(find 'Sous-titres : '); echo "pastille -> $XY"; [ -n "$XY" ] && adb shell input tap $XY; sleep 2; cap 7-mode2.png
adb shell input tap $((LW/2)) 200; sleep 0.4
XY=$(find 'Sous-titres : '); [ -n "$XY" ] && adb shell input swipe $XY $XY 1200; sleep 2; cap 8-reglages.png
XY=$(find 'Position'); echo "position -> $XY"; [ -n "$XY" ] && adb shell input tap $XY; sleep 2
adb shell input keyevent 4; sleep 4; cap 9-haut.png
adb shell input keyevent 4; sleep 2; adb shell input keyevent 4; sleep 2
