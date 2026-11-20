# Décide la touche de la télécommande pour amener le cadre sur l'élément qui contient le texte voulu.
import re, sys
xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
want = sys.argv[2]
# arbre simplifié : on garde (profondeur, attributs)
toks = re.findall(r'<node ([^>]*?)(/?)>|</node>', xml)
stack = []; nodes = []
for m in re.finditer(r'<node ([^>]*?)(/?)>|</node>', xml):
    if m.group(0).startswith('</'):
        stack.pop(); continue
    attrs = m.group(1)
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', attrs)
    n = {"a": attrs, "b": tuple(map(int, b.groups())) if b else (0,0,0,0), "kids": []}
    if stack: stack[-1]["kids"].append(n)
    nodes.append(n)
    if m.group(2) != '/': stack.append(n)
def has(n, t):
    return ('text="%s"' % t) in n["a"] or any(has(k, t) for k in n["kids"])
foc = [n for n in nodes if 'focused="true"' in n["a"]]
tgt = [n for n in nodes if 'clickable="true"' in n["a"] and has(n, want)]
if not tgt: print("absent"); sys.exit()
t = tgt[0]
if not foc: print("DPAD_DOWN"); sys.exit()
f = foc[-1]
if has(f, want): print("ok"); sys.exit()
fy = (f["b"][1] + f["b"][3]) // 2; ty = (t["b"][1] + t["b"][3]) // 2
fx = (f["b"][0] + f["b"][2]) // 2; tx = (t["b"][0] + t["b"][2]) // 2
if abs(fy - ty) > 20: print("DPAD_DOWN" if fy < ty else "DPAD_UP")
else: print("DPAD_RIGHT" if fx < tx else "DPAD_LEFT")
