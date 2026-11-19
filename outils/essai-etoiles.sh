#!/bin/bash
# Essai des étoiles sur un flux HLS public d'essai (pas YouTube). Positions relevées sur les essais précédents.
cap() { adb shell screencap -p /sdcard/s.png; adb pull /sdcard/s.png "$1" >/dev/null; }
adb shell settings put secure immersive_mode_confirmations confirmed
W=$(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1); LW=${W%x*}
if [ "$LW" -gt 2000 ]; then S1="2320 68"; S3="2488 68"; IT="1280 553"; C="1280 900"; else S1="752 238"; S3="982 238"; IT="540 802"; C="540 1300"; fi
star() { adb shell "input tap $C; sleep 0.3; input tap $1"; }
adb shell am start -n fr.hadesdray.youpub/.ui.LiveActivity --es name Essai --esal urls "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
sleep 20
adb shell input tap $C; sleep 0.5; cap 5-direct-etoiles.png; sleep 4
star "$S1"; sleep 2; cap 6-dossier-favori.png
adb shell input tap $IT; sleep 4
star "$S3"; sleep 8; cap 7-versions-video.png
adb shell input tap $IT; sleep 20; cap 8-enregistrement.png
adb shell input tap $S3; sleep 8; cap 9-arret.png
adb shell am start -n fr.hadesdray.youpub/.ui.LibraryActivity; sleep 5; cap 10-favoris-dossiers.png
