# tools/book-pdf-diff.py
# ════════════════════════════════════════════════════════════════════════
#  Сверка packs-src/books/<slug>.json со страницами исходного PDF.
#
#  book-coverage.py отвечает на вопрос «доехал ли текст вообще». Этот
#  инструмент — на вопрос «доехал ли он ЦЕЛЫМ и НА СВОЁ МЕСТО»: ловит
#  двухколоночную кашу, выпавшие куски и подменённые формулировки.
#
#  Четыре проверки, ни одной по отдельности не хватает:
#
#    СТЫКИ   доля соседних строк одного блока PDF, которые в книге НЕ идут
#            подряд. Колоночная каша рвёт стык: грязная страница даёт
#            40-100%, чистая 0-6%. Обязательна де-дефисация — в тексте PDF
#            перенос это «ци-\n», без склейки шум 40% на любой странице.
#
#    ШИНГЛЫ  доля 3-словных цепочек страницы PDF, которых нет в главе.
#            Ловит выпавший текст. Порог шума 1-5%; таблицы дают до 20%
#            ложных из-за порядка ячеек — их смотреть отдельно.
#
#    МЕСТО   то же, но против секций <section data-pdf-page> N-1/N/N+1, а
#            не против всей главы. Ловит то, что сверка по главе ПРЯЧЕТ:
#            повторяющаяся формулировка («Создание круга требует тест
#            на…») находится где-то ещё в главе, и общая сверка считает её
#            на месте, хотя на своём месте она подменена.
#
#    ЧИСЛА   мультимножество числовых токенов страницы против тех же
#            секций. Дёшево и ловит подменённый модификатор.
#
#  Плюс СНОСКИ: каждая жирная строка PDF ищется в тексте книги — ловит
#  выпавшие подписи строк таблиц (имя приёма/свойства над его строкой).
#
#  Только читает. Ничего не правит.
#
#    python tools/book-pdf-diff.py <slug> [--entry=N] [--pages=A-B]
#                                  [--min=4] [--out=ФАЙЛ]
#
#  --entry=N   индекс главы в entries[]; страницы берутся из pdfPage её
#              страниц (последняя глава — до --end или до своей же
#              последней страницы).
#  --pages=A-B явный диапазон страниц PDF, перекрывает --entry.
#  --min=4     минимальная длина серии подряд не найденных шинглов, о
#              которой стоит докладывать (короче — обычно шум вёрстки).
#
#  Вывод — под PYTHONIOENCODING=utf-8, иначе консоль портит кириллицу;
#  с --out пишется в файл, кодировка гарантирована.
# ════════════════════════════════════════════════════════════════════════
import sys, os, re, json, importlib.util
from collections import Counter
from html import unescape

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

_spec = importlib.util.spec_from_file_location(
    "bookcov", os.path.join(ROOT, "tools", "book-coverage.py"))
_cov = importlib.util.module_from_spec(_spec)
_argv, sys.argv = sys.argv, [sys.argv[0]]
_spec.loader.exec_module(_cov)
sys.argv = _argv

WORD = re.compile(r"[а-яa-z0-9]+")
SPACE_BEFORE_PUNCT = re.compile(r"\s+([.,:;!?…»)\]])")


def strip_tags(text):
    """Снимает HTML-теги, не оставляя паразитный пробел перед пунктуацией.

    Наивная замена тега на пробел нужна между словами (`</strong>Иначе` не
    должно слипнуться в «ИначеБез_пробела»), но перед знаком препинания
    пробела в исходнике нет: «<strong>Прием</strong>: Х.» должно читаться
    как «Прием: Х.», а не «Прием : Х.» — лишний пробел перед двоеточием
    иначе даёт ложное «подпись не найдена» при сверке с PDF, где знак
    препинания всегда приклеен к слову.
    """
    t = re.sub(r"(?s)<[^>]+>", " ", text or "")
    return SPACE_BEFORE_PUNCT.sub(r"\1", t)


def words(text):
    """Слова в сравнимом виде: без разметки, ё→е, апострофы к одному виду."""
    t = strip_tags(text)
    t = unescape(t).replace("ё", "е").replace("Ё", "Е").replace("’", "'").lower()
    return WORD.findall(t)


def page_text(page):
    """Текст страницы PDF со склеенными переносами."""
    return page.get_text().replace("-" + chr(10), "")


def page_blocks(page):
    """Блоки страницы как списки строк-слов; блоки короче двух строк не нужны."""
    out = []
    for blk in page.get_text("dict")["blocks"]:
        if blk.get("type") != 0:
            continue
        lines = [words("".join(s["text"] for s in ln["spans"])) for ln in blk["lines"]]
        lines = [w for w in lines if w]
        if len(lines) >= 2:
            out.append(lines)
    return out


def bold_lines(page):
    """Жирные короткие строки страницы — подписи строк таблиц и заголовки."""
    out = []
    for blk in page.get_text("dict")["blocks"]:
        if blk.get("type") != 0:
            continue
        for ln in blk["lines"]:
            txt = "".join(s["text"] for s in ln["spans"]).strip()
            fonts = " ".join(s["font"].lower() for s in ln["spans"])
            if not txt or len(txt) > 40:
                continue
            if "bold" not in fonts and "black" not in fonts:
                continue
            if re.fullmatch(r"[\d\s\-–—+]+", txt):
                continue
            if "   " in txt:      # провал из трёх пробелов — склейка двух колонок
                continue
            out.append(txt)
    return out


def glue(pdf_words, vocab):
    """Склеивает пару слов, если склейка есть в словаре книги, а половинки нет.

    Перенос без дефиса (текстовый слой рвёт слово на границе колонки) иначе
    даёт ложный разрыв на каждой такой строке.
    """
    out, i = [], 0
    while i < len(pdf_words):
        if i + 1 < len(pdf_words):
            merged = pdf_words[i] + pdf_words[i + 1]
            if merged in vocab and (pdf_words[i] not in vocab or pdf_words[i + 1] not in vocab):
                out.append(merged)
                i += 2
                continue
        out.append(pdf_words[i])
        i += 1
    return out


def trigrams(ws):
    return set(" ".join(ws[i:i + 3]) for i in range(len(ws) - 2))


def junction_score(page, book_index):
    """Доля порванных стыков соседних строк внутри блока и примеры."""
    ok = bad = 0
    examples = []
    for lines in page_blocks(page):
        for a, b in zip(lines, lines[1:]):
            if len(a) < 3 or len(b) < 3:
                continue
            plain = " ".join(a[-3:] + b[:3])
            hyphen = " ".join(a[-3:-1] + [a[-1] + b[0]] + b[1:3])
            if plain in book_index or hyphen in book_index:
                ok += 1
            else:
                bad += 1
                if len(examples) < 4:
                    examples.append(plain)
    total = ok + bad
    return (100.0 * bad / total if total else 0.0), total, examples


def missing_runs(pdf_words, known, min_len):
    """Серии подряд не найденных троек — с контекстом вокруг."""
    runs, cur = [], []
    for i in range(len(pdf_words) - 2):
        if " ".join(pdf_words[i:i + 3]) not in known:
            cur.append(i)
        elif cur:
            runs.append(cur)
            cur = []
    if cur:
        runs.append(cur)
    out = []
    for r in runs:
        if len(r) < min_len:
            continue
        a, b = r[0], r[-1] + 3
        ctx = pdf_words[max(0, a - 5):b + 5]
        if len(ctx) > 45:                      # длинную серию печатаем краями
            ctx = ctx[:22] + ["…"] + ctx[-22:]
        out.append((len(r), " ".join(ctx)))
    return out


def sections_by_page(html_all):
    """Карта «страница PDF → куски html её секции»."""
    out = {}
    for m in re.finditer(r'<section data-pdf-page="(\d+)">(.*?)(?=<section data-pdf-page=|$)',
                         html_all, re.S):
        out.setdefault(int(m.group(1)), []).append(m.group(2))
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
    if not args:
        print(__doc__ or "укажи slug книги, см. шапку файла")
        return 2
    slug = args[0]
    min_len = int(opts.get("min", 4))

    src = _cov.SOURCES.get(slug)
    if not src:
        print(f"нет такого slug: {slug}; известные: {', '.join(sorted(_cov.SOURCES))}")
        return 2
    pdf_path = os.path.join(*src)
    if not pdf_path.lower().endswith(".pdf"):
        print(f"{slug} собран не из PDF ({os.path.basename(pdf_path)}) — "
              f"колоночной каши там быть не может, для него подходит tools/book-coverage.py")
        return 2

    import pymupdf  # ставится только ради этого инструмента, не тянуть в общий импорт

    book = json.load(open(os.path.join(ROOT, "packs-src", "books", slug + ".json"),
                          encoding="utf-8"))
    entries = book["entries"]
    ei = int(opts["entry"]) if "entry" in opts and opts["entry"] is not True else None

    if "pages" in opts and opts["pages"] is not True:
        lo, _, hi = str(opts["pages"]).partition("-")
        lo, hi = int(lo), int(hi or lo)
        scope = entries if ei is None else [entries[ei]]
    elif ei is not None:
        pages = [p for p in entries[ei]["pages"] if p.get("pdfPage")]
        lo = min(p["pdfPage"] for p in pages)
        hi = int(opts.get("end", 0)) or max(p["pdfPage"] for p in pages)
        scope = [entries[ei]]
    else:
        print("нужен --entry=N или --pages=A-B")
        return 2

    html_all = " ".join(p.get("html", "") for e in scope for p in e["pages"])
    chapter_words = words(html_all)
    chapter_tri = trigrams(chapter_words)
    vocab = set(chapter_words)
    junction_index = set(" ".join(chapter_words[i:i + 6]) for i in range(len(chapter_words) - 5))
    junction_index |= set(" ".join(chapter_words[i:i + 5]) for i in range(len(chapter_words) - 4))
    sections = sections_by_page(html_all)
    book_plain = re.sub(r"\s+", " ", unescape(strip_tags(html_all))).replace("ё", "е").lower()

    doc = pymupdf.open(pdf_path)
    report = [f"книга {slug} · {os.path.basename(pdf_path)} · страницы {lo}-{hi}",
              "стык% — двухколоночная каша; шингл% — выпавший текст; далее находки", ""]

    for pn in range(lo, hi + 1):
        if pn < 1 or pn > doc.page_count:
            continue
        page = doc[pn - 1]
        pct, total, ex = junction_score(page, junction_index)
        pw = glue(words(page_text(page)), vocab)
        miss = sum(1 for i in range(len(pw) - 2) if " ".join(pw[i:i + 3]) not in chapter_tri)
        shingle_pct = 100.0 * miss / max(len(pw) - 2, 1)

        flag = "  <<<" if pct > 12 or shingle_pct > 8 else ""
        report.append(f"стр {pn}: стык {pct:.0f}% из {total}, шингл {shingle_pct:.0f}%{flag}")
        if pct > 12:
            for e in ex:
                report.append(f"    стык порван: …{e}…")

        # МЕСТО и ЧИСЛА — против своей секции и соседних. Без СВОЕЙ секции
        # проверка бессмысленна: не с чем сравнивать, вся страница «не на
        # месте» — такие страницы отмечаем и пропускаем.
        local = [h for k in (pn - 1, pn, pn + 1) for h in sections.get(k, [])]
        if pn not in sections:
            report.append("    (у страницы нет своей секции data-pdf-page — "
                          "проверки «не на месте» и «числа» пропущены)")
        elif local:
            lw = words(" ".join(local))
            local_tri = trigrams([w for w in lw if not w.isdigit()])
            for length, ctx in missing_runs([w for w in pw if not w.isdigit()], local_tri, min_len):
                report.append(f"    не на месте [{length}]: …{ctx}…")
            lacking = Counter(w for w in pw if w.isdigit()) - Counter(w for w in lw if w.isdigit())
            lacking.pop(str(pn), None)          # колонтитул с номером страницы
            if lacking:
                report.append("    чисел нет в книге: " +
                              ", ".join(f"{k}×{v}" for k, v in sorted(lacking.items(), key=lambda x: -x[1])[:12]))

        for cap in bold_lines(page):
            if cap.replace("ё", "е").lower() not in book_plain:
                report.append(f"    подписи нет в книге: {cap}")

    text = "\n".join(report)
    out = opts.get("out")
    if out and out is not True:
        open(out, "w", encoding="utf-8", newline="\n").write(text + "\n")
        print(f"отчёт записан: {out}")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
