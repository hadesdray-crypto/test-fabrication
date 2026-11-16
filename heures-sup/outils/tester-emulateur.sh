#!/bin/bash
# Test sur téléphone virtuel : installe l'APK, lance le test intégré, capture l'écran, vérifie le résultat.
set -u
NOM="$1"; APK="$2"; SORTIE="captures/$NOM"; mkdir -p "$SORTIE"
adb wait-for-device
adb shell settings put global window_animation_scale 0 || true
adb shell input keyevent KEYCODE_WAKEUP || true
adb shell wm dismiss-keyguard || true
sleep 2
adb install -r -g "$APK" || { echo "ECHEC installation"; exit 1; }
adb logcat -c
adb shell am start -n fr.heuressup/.MainActivity --ez autotest true
sleep 4; adb exec-out screencap -p > "$SORTIE/0-accueil.png"
FIN=""
for s in $(seq 1 40); do
  sleep 2
  adb logcat -d -s HEURESSUP:I > "$SORTIE/journal.txt"
  if grep -q 'AUTOTEST FIN' "$SORTIE/journal.txt"; then FIN=$(grep -o 'AUTOTEST FIN [A-Z]*' "$SORTIE/journal.txt" | tail -1); break; fi
done
adb exec-out screencap -p > "$SORTIE/1-fin.png"
adb logcat -d > "$SORTIE/logcat-complet.txt"
cat "$SORTIE/journal.txt"
grep -E 'FATAL EXCEPTION' -A8 "$SORTIE/logcat-complet.txt" | head -30
if grep -q 'FATAL EXCEPTION' "$SORTIE/logcat-complet.txt"; then echo "ECHEC plantage"; exit 1; fi
if [ "$FIN" != "AUTOTEST FIN OK" ]; then echo "ECHEC : ${FIN:-pas de fin}"; exit 1; fi
echo "REUSSITE $NOM"
