# tools/book-holes.py
# ════════════════════════════════════════════════════════════════════════
#  Разбор «дыр» из book-coverage.py на настоящие потери и ложные.
#
#  Шингл из 6 слов не находится по двум разным причинам:
#    1) текста нет вообще — настоящая потеря;
#    2) текст есть, но разложен иначе — строка таблицы PDF разошлась по
#       карточкам предметов по одной ячейке, и подряд эти слова нигде не
#       стоят. Это не потеря.
#
#  Различает их доля цепочек по 3 слова, найденных где-то в packs-src.
#  Одиночное слово — слишком слабый признак: почти любое русское слово
#  найдётся в корпусе на два миллиона слов, и пропажа целого абзаца
#  замаскируется под «переложено». Цепочка из трёх слов принадлежит уже
#  конкретному тексту: нет её — нет и текста.
#
#  Только читает. Ничего не правит.
#
#    python tools/book-holes.py [<slug> …] [--min=20] [--out=ДИР]
# ════════════════════════════════════════════════════════════════════════
import sys, os, importlib.util

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_argv = sys.argv[1:]
sys.argv = [sys.argv[0]]
spec = importlib.util.spec_from_file_location(
    "cov", os.path.join(ROOT, "tools", "book-coverage.py"))
cov = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cov)

opts = {a.split("=")[0]: (a.split("=", 1)[1] if "=" in a else True)
        for a in _argv if a.startswith("--")}
slugs = [a for a in _argv if not a.startswith("--")] or sorted(cov.SOURCES)
hole_min = int(opts.get("--min", 20))
outdir = opts.get("--out")
if outdir:
    os.makedirs(outdir, exist_ok=True)

M = 3           # длина проверочной цепочки
KNOWN = 0.50    # ниже этой доли найденных цепочек дыра считается потерей


def trigrams(ws):
    return {tuple(ws[i:i + M]) for i in range(len(ws) - M + 1)}


CORPUS_WORDS = cov.words(cov.corpus_all())
CORPUS3 = trigrams(CORPUS_WORDS)
CORPUS6 = cov.shingles(CORPUS_WORDS)


def known_share(seg):
    tg = trigrams(seg)
    return len(tg & CORPUS3) / len(tg) if tg else 1.0


for slug in slugs:
    chunks, path = cov.load_source(slug)
    if chunks is None:
        print(f"{slug:<18} ИСХОДНИК НЕ НАЙДЕН: {path}")
        continue
    _book, tgt_text = cov.load_target(slug)
    tgt = cov.shingles(cov.words(tgt_text)) | CORPUS6

    lost, moved = [], []
    for label, text in chunks:
        ws = cov.words(text)
        if len(ws) < cov.N:
            continue
        mark = [False] * len(ws)
        for i in range(len(ws) - cov.N + 1):
            if tuple(ws[i:i + cov.N]) in tgt:
                for j in range(i, i + cov.N):
                    mark[j] = True
        i = 0
        while i < len(mark):
            if mark[i]:
                i += 1
                continue
            j = i
            while j < len(mark) and not mark[j]:
                j += 1
            if j - i >= hole_min:
                seg = ws[i:j]
                rec = (label, j - i, known_share(seg), " ".join(seg))
                (moved if rec[2] >= KNOWN else lost).append(rec)
            i = j

    lost.sort(key=lambda x: -x[1])
    lw, mw = sum(x[1] for x in lost), sum(x[1] for x in moved)
    print(f"{slug:<18} потеряно: дыр {len(lost):>3}, слов {lw:>6}"
          f"   |   переложено/таблицы: дыр {len(moved):>3}, слов {mw:>6}")

    if outdir:
        with open(os.path.join(outdir, slug + ".txt"), "w", encoding="utf-8") as f:
            f.write(f"# {slug} — исходник {path}\n")
            f.write(f"# НАСТОЯЩИЕ ПОТЕРИ: {len(lost)} дыр / {lw} слов\n")
            f.write(f"# переложено или таблица (цепочки нашлись): {len(moved)} дыр / {mw} слов\n\n")
            f.write("=" * 70 + "\nНАСТОЯЩИЕ ПОТЕРИ\n" + "=" * 70 + "\n\n")
            for label, n, known, txt in lost:
                f.write(f"--- {label}  ({n} слов, цепочек найдено {known:.0%})\n{txt}\n\n")
            f.write("=" * 70 + "\nПЕРЕЛОЖЕНО / ТАБЛИЦЫ\n" + "=" * 70 + "\n\n")
            for label, n, known, txt in sorted(moved, key=lambda x: -x[1]):
                f.write(f"--- {label}  ({n} слов, цепочек найдено {known:.0%})\n{txt[:300]}\n\n")
