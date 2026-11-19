import re, sys
xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
nodes = re.findall(r'<node [^>]*>', xml)
def b(n):
    m = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n); return tuple(map(int, m.groups())) if m else None
if sys.argv[2] == "etoile":
    k = int(sys.argv[3])
    sq = []
    for n in nodes:
        if 'class="android.widget.FrameLayout"' in n and 'clickable="true"' in n:
            x1, y1, x2, y2 = b(n); w, h = x2 - x1, y2 - y1
            if w > 30 and abs(w - h) <= 3: sq.append((y1, x1, x2, y2))
    rows = {}
    for s in sq: rows.setdefault(s[0], []).append(s)
    for y, r in sorted(rows.items()):
        if len(r) >= 3:
            r.sort(key=lambda s: s[1]); s = r[k - 1]
            print((s[1] + s[2]) // 2, (s[0] + s[3]) // 2); break
else:
    for n in nodes:
        if sys.argv[3] in n:
            x1, y1, x2, y2 = b(n); print((x1 + x2) // 2, (y1 + y2) // 2); break
