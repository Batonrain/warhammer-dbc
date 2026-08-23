# tools/pdf-art.py
# ════════════════════════════════════════════════════════════════════════
#  Извлечение артов книги из PDF в assets/art/<книга>/.
#
#  Из PDF достаются только иллюстрации: фон страницы, подвал и прочий декор
#  повторяются почти на каждой странице и отсеиваются по числу вхождений,
#  мелочь вроде иконок — по размеру. Имя файла выводится из ближайшей сверху
#  закладки PDF (боковая панель), поэтому арт машины называется её именем;
#  при совпадении имён добавляется номер.
#
#  Использование:
#    python tools/pdf-art.py <книга.pdf> <slug-папки> [--dry] [--min=180]
# ════════════════════════════════════════════════════════════════════════
import io, sys, os, re, collections, pymupdf
from PIL import Image

TRANSLIT = {**{c: l for c, l in zip("абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
    ["a","b","v","g","d","e","e","zh","z","i","y","k","l","m","n","o","p","r","s","t",
     "u","f","h","c","ch","sh","sch","","y","","e","yu","ya"])}}

def translit(s):
    out = []
    for ch in s.lower():
        out.append(TRANSLIT.get(ch, ch if ch.isalnum() else "-"))
    return re.sub(r"-+", "-", "".join(out)).strip("-") or "art"

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opts = dict((a[2:].split("=") + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
src, slug = args[0], args[1]
minside = int(opts.get("min", 180))
dry = "dry" in opts
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "art", slug)

doc = pymupdf.open(src)
toc = doc.get_toc()

# закладки страницы: имя + место заголовка в тексте (search_for), чтобы арт
# получил имя того заголовка, к которому он прижат, а не последнего на странице
def anchors(page):
    out = []
    for lvl, title, pg in toc:
        if pg != page.number + 1 or lvl < 2: continue
        hits = page.search_for(title[:40])
        out.append((title, hits[0] if hits else None, lvl))
    return out

def name_for(page, rect, pno):
    a = [x for x in anchors(page) if x[1]]
    if not a:                                       # заголовок не нашёлся текстом — берём ближайший сверху
        prev = [t for l, t, pg in toc if pg <= pno and l >= 2]
        return prev[-1] if prev else f"page-{pno}"
    deepest = max(x[2] for x in a)
    a = [x for x in a if x[2] == deepest] or a
    mid = page.rect.width / 2
    same_col = [x for x in a if (x[1].x0 < mid) == (rect.x0 < mid)] or a
    below = [x for x in same_col if x[1].y0 >= rect.y0]
    return (min(below, key=lambda x: x[1].y0) if below
            else max(same_col, key=lambda x: x[1].y0))[0]

# декор: одна и та же картинка на многих страницах
seen = collections.Counter()
for page in doc:
    for img in page.get_images(full=True): seen[img[0]] += 1
decor = {x for x, n in seen.items() if n > 3}

if not dry: os.makedirs(root, exist_ok=True)
used, saved = collections.Counter(), 0
for pno, page in enumerate(doc, 1):
    imgs = []
    for img in page.get_images(full=True):
        xref, smask, w, h = img[0], img[1], img[2], img[3]
        if xref in decor or min(w, h) < minside: continue
        rects = page.get_image_rects(xref)
        r = rects[0] if rects else pymupdf.Rect(0, 0, 1, 1)
        imgs.append((r.y0, r.x0, xref, smask, w, h, r))
    for _, _, xref, smask, w, h, r in sorted(imgs):
        base = translit(name_for(page, r, pno))
        used[base] += 1
        name = base if used[base] == 1 else f"{base}-{used[base]}"
        path = os.path.join(root, f"{name}.webp")
        print(f"стр.{pno:>3}  {w}x{h}  → assets/art/{slug}/{name}.webp")
        if not dry:                                  # webp мимо pymupdf: он умеет только png/jpg
            pix = pymupdf.Pixmap(doc, xref)
            if smask:                                # альфа-канал хранится отдельной картинкой
                mask = pymupdf.Pixmap(doc, smask)
                if pix.alpha:                         # своя альфа уже есть — merge с маской её не примет
                    pix = pymupdf.Pixmap(pix, 0)
                try:
                    pix = pymupdf.Pixmap(pix, mask)
                except pymupdf.mupdf.FzErrorArgument:  # несовместимая пара — берём картинку без альфы
                    pass
            if pix.colorspace and pix.colorspace.n > 3:  # CMYK Pixmap не умеет в PNG
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            Image.open(io.BytesIO(pix.tobytes("png"))).save(path, "WEBP", quality=88, method=6)
        saved += 1
print(f"\nвсего иллюстраций: {saved} (отсеяно декора: {len(decor)} шт.)")
