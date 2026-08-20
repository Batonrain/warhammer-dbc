# tools/pdf-text.py
# ════════════════════════════════════════════════════════════════════════
#  Текст страницы PDF по блокам, разложенный по колонкам.
#
#  Сплошной текстовый слой книг сшивает левую и правую колонку в одну строку
#  (а иногда и посимвольно), поэтому текст берётся блоками с координатами:
#  блок целиком лежит в своей колонке, и порядок чтения восстанавливается
#  сортировкой «левая колонка сверху вниз, затем правая».
#
#  Использование:
#    python tools/pdf-text.py <книга.pdf> <страницы> [--cols=2] [--coords]
# ════════════════════════════════════════════════════════════════════════
import sys, pymupdf

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opts = dict((a[2:].split("=") + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
cols = int(opts.get("cols", 2))

def parse_pages(spec, n):
    out = []
    for part in str(spec).split(","):
        if "-" in part:
            a, b = part.split("-"); out += list(range(int(a), int(b) + 1))
        else: out.append(int(part))
    return [p for p in out if 1 <= p <= n]

doc = pymupdf.open(args[0])
for pno in parse_pages(args[1] if len(args) > 1 else "1", doc.page_count):
    page = doc[pno - 1]
    w = page.rect.width
    blocks = [b for b in page.get_text("blocks") if b[6] == 0 and b[4].strip()]
    # колонка блока — по центру его прямоугольника
    def key(b):
        cx = (b[0] + b[2]) / 2
        col = min(int(cx / (w / cols)), cols - 1)
        return (col, round(b[1], 1), b[0])
    print(f"\n{'═' * 70}\nСТРАНИЦА {pno}\n{'═' * 70}")
    last_col = None
    for b in sorted(blocks, key=key):
        col = key(b)[0]
        if col != last_col:
            print(f"\n--- колонка {col + 1} ---"); last_col = col
        if opts.get("coords"): print(f"[{b[0]:.0f},{b[1]:.0f}–{b[2]:.0f},{b[3]:.0f}]")
        print(b[4].rstrip())
