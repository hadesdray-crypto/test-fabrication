#!/bin/bash
# Test sur téléphone virtuel : installe l'APK, lance le test automatique, prend des captures, vérifie le résultat.
set -u
NOM="$1"; APK="$2"; SORTIE="captures/$NOM"; mkdir -p "$SORTIE"
adb wait-for-device
adb shell settings put global window_animation_scale 0 || true
adb install -r -g "$APK" || { echo "ECHEC installation"; exit 1; }
adb logcat -c
adb shell am start -n fr.jeuxlive/.MainActivity --ez autotest true --es compte_test "${COMPTE_TEST:-tv_asahi_news}"
sleep 4; adb exec-out screencap -p > "$SORTIE/0-accueil.png"
FIN=""; n=0
for s in $(seq 1 110); do
  sleep 2
  adb logcat -d -s JEUXLIVE:I > "$SORTIE/journal.txt"
  for c in $(grep -o 'AUTOTEST CAPTURE [a-z]*' "$SORTIE/journal.txt" | awk '{print $3}'); do
    if [ ! -f "$SORTIE/1-$c.png" ]; then sleep 6; adb exec-out screencap -p > "$SORTIE/1-$c.png"; fi
  done
  if grep -q 'AUTOTEST FIN' "$SORTIE/journal.txt"; then FIN=$(grep -o 'AUTOTEST FIN [A-Z]*' "$SORTIE/journal.txt" | tail -1); break; fi
done
adb logcat -d > "$SORTIE/logcat-complet.txt"
grep -E 'AUTOTEST|jeu:' "$SORTIE/journal.txt"
grep -E 'FATAL EXCEPTION|AndroidRuntime' -A8 "$SORTIE/logcat-complet.txt" | head -40
if grep -q 'FATAL EXCEPTION' "$SORTIE/logcat-complet.txt"; then echo "ECHEC plantage"; exit 1; fi
if [ "$FIN" != "AUTOTEST FIN OK" ]; then echo "ECHEC : ${FIN:-pas de fin}"; exit 1; fi
echo "REUSSITE $NOM"
