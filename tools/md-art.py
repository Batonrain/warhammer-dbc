# tools/md-art.py
# ════════════════════════════════════════════════════════════════════════
#  Извлечение артов книги из markdown-экспорта (.md, Google Docs) в
#  assets/art/<книга>/ — тот же результат, что pdf-art.py, для источников
#  без PDF (sources/, см. tools/book-coverage.py::SOURCES).
#
#  Картинки markdown-экспорта лежат встроенным base64 отдельными строками-
#  сносками: `[imageN]: <data:image/png;base64,...>`; по тексту на них
#  ссылаются `![][imageN]`. Имя файла — по ближайшему заголовку (#/##/###)
#  СВЕРХУ от места ссылки, тот же принцип, что pdf-art.py берёт из
#  ближайшей закладки PDF.
#
#  Повторяющиеся картинки (логотип, декоративный разделитель) отсеиваются
#  по СОВПАДЕНИЮ base64-содержимого, не по числу вхождений на странице —
#  у markdown-экспорта нет понятия «страница», отсеивать частотой нечем.
#
#  Использование:
#    python tools/md-art.py <книга.md> <slug-папки> [--dry] [--min=180]
# ════════════════════════════════════════════════════════════════════════
import sys, os, re, io, base64, collections
from PIL import Image

TRANSLIT = {**{c: l for c, l in zip("абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
    ["a","b","v","g","d","e","e","zh","z","i","y","k","l","m","n","o","p","r","s","t",
     "u","f","h","c","ch","sh","sch","","y","","e","yu","ya"])}}


def translit(s):
    out = []
    for ch in s.lower():
        out.append(TRANSLIT.get(ch, ch if ch.isalnum() else "-"))
    return re.sub(r"-+", "-", "".join(out)).strip("-") or "art"


IMAGE_DEF = re.compile(r"^\[(image\d+)\]:\s*<data:image/(\w+);base64,([A-Za-z0-9+/=]+)>\s*$", re.MULTILINE)
IMAGE_REF = re.compile(r"!\[[^\]]*\]\[(image\d+)\]")
HEADING = re.compile(r"^(#{1,6})\s*\**\s*(.+?)\**\s*$", re.MULTILINE)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = dict((a[2:].split("=") + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
    src, slug = args[0], args[1]
    minside = int(opts.get("min", 180))
    dry = "dry" in opts
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "art", slug)

    text = open(src, encoding="utf-8", errors="replace").read()

    # Заголовки по позиции символа в файле — для «ближайший заголовок сверху».
    headings = [(m.start(), m.group(2).strip()) for m in HEADING.finditer(text)]

    def heading_before(pos):
        cand = [h for h in headings if h[0] <= pos]
        return cand[-1][1] if cand else "art"

    defs = {m.group(1): (m.group(2), m.group(3)) for m in IMAGE_DEF.finditer(text)}
    refs = [(m.start(), m.group(1)) for m in IMAGE_REF.finditer(text)]

    if not dry:
        os.makedirs(root, exist_ok=True)

    seen_hash = set()
    used = collections.Counter()
    saved = skipped_dup = skipped_small = skipped_bad = 0

    for pos, img_id in refs:
        if img_id not in defs:
            print(f"! {img_id} — ссылка есть, определения нет (сноска потеряна при экспорте?)")
            continue
        _fmt, b64 = defs[img_id]
        try:
            raw = base64.b64decode(b64)
            im = Image.open(io.BytesIO(raw))
            im.load()
        except Exception as e:
            print(f"! {img_id} — не открылось как картинка: {e}")
            skipped_bad += 1
            continue

        digest = hash(raw)
        if digest in seen_hash:
            skipped_dup += 1
            continue
        seen_hash.add(digest)

        w, h = im.size
        if min(w, h) < minside:
            skipped_small += 1
            continue

        base = translit(heading_before(pos))
        used[base] += 1
        name = base if used[base] == 1 else f"{base}-{used[base]}"
        path = os.path.join(root, f"{name}.webp")
        print(f"{img_id:>10}  {w}x{h}  → assets/art/{slug}/{name}.webp")
        if not dry:
            if im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGBA" if "A" in im.mode else "RGB")
            im.save(path, "WEBP", quality=88, method=6)
        saved += 1

    print(f"\nвсего иллюстраций: {saved} "
          f"(дублей: {skipped_dup}, мелких: {skipped_small}, нечитаемых: {skipped_bad})")


if __name__ == "__main__":
    main()
