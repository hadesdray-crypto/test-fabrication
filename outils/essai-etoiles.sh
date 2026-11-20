#!/bin/bash
# Essai 1.0.113 : ouverture du lecteur vidéo (traduction branchée) sans plantage.
cap() { adb shell screencap -p /sdcard/s.png; adb pull /sdcard/s.png "$1" >/dev/null; }
adb shell am start -n fr.hadesdray.youpub/.ui.VideoActivity --es url "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
sleep 25; cap 5-lecteur.png
adb shell input keyevent 4; sleep 3
adb shell am start -n fr.hadesdray.youpub/.ui.LiveActivity --es name Essai --esal urls "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
sleep 15; cap 6-direct.png
