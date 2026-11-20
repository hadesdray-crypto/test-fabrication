#!/bin/bash
# Essai 1.0.114 : vidéo inexistante → message en français ; vidéo normale → lecture.
cap() { adb shell screencap -p /sdcard/s.png; adb pull /sdcard/s.png "$1" >/dev/null; }
adb shell am start -n fr.hadesdray.youpub/.ui.VideoActivity --es url "https://www.youtube.com/watch?v=aaaaaaaaaaa"
sleep 40; cap 5-bloquee.png
adb shell input keyevent 4; sleep 3
adb shell am start -n fr.hadesdray.youpub/.ui.VideoActivity --es url "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
sleep 25; cap 6-lecture.png
