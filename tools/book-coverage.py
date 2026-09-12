# tools/book-coverage.py
# ════════════════════════════════════════════════════════════════════════
#  Сколько текста исходника книги реально доехало до
#  packs-src/books/<slug>.json.
#
#  Метод — покрытие словесными шинглами (6 слов). Устойчиво к склейке
#  колонок и перестановке абзацев: если текст есть где угодно в книге,
#  шингл найдётся. Не найден — текста нет, это дыра, а не перестановка.
#
#  Только читает. Ничего не правит.
#
#    python tools/book-coverage.py [slug ...] [--holes=N] [--dump=ДИР]
#    python tools/book-coverage.py --selftest   # только самопроверка фильтра
#                                                # шума таблиц, см. wdbc-3iw
# ════════════════════════════════════════════════════════════════════════
import sys, os, re, json, zipfile, io
from html import unescape
from collections import Counter, defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# 10.09.2026, прямое указание владельца: источником истины всегда считать то,
# что лежит в репозитории (sources/), а не личные внешние копии — те могут
# отсутствовать на конкретной машине (см. wdbc-qptj, "ИСХОДНИК НЕ НАЙДЕН") или
# быть более старой/другой ревизией документа (см. wdbc-hfa1/wdbc-sgw0).
SRC = os.path.join(ROOT, "sources")

SOURCES = {
    "aeldari-branches": (SRC, "Книга Аэльдари_ Ответвления.md"),
    "aeldari":          (SRC, "Книга Аэльдари.md"),
    "battles":          (SRC, "Книга Битв.md"),
    "chaos":            (SRC, "DoomBC_S_Chaos.pdf"),
    "core":             (SRC, "DoomBC_Core .pdf"),
    "daemonic-shells":  (SRC, "Книга Демонических Оболочек.md"),
    "diseases":         (SRC, "Книга Болезней.md"),
    "divinations-book": (SRC, "Предсказания.md"),
    "eldar-vehicles":   (SRC, "Книга Эльдар_ Техника.md"),
    "machines":         (SRC, "DoomBC_Machines.pdf"),
    "necrons":          (SRC, "Книга Некронов.md"),
    "origins-book":     (SRC, "Родные миры.md"),
    "power-armour":     (SRC, "Силовая броня_ без шлема и особенности.md"),
    "toad-psykers":     (SRC, "Книга Псайкеров.md"),
    "tyranids":         (SRC, "Книга Тиранидов.md"),
    "void":             (SRC, "Книга Пустоты.md"),
}

CORPUS = []
N = 6                      # длина шингла в словах
HYPHEN = re.compile(r"(\w)-\s*\n\s*(\w)")
WORD = re.compile(r"[0-9A-Za-zА-Яа-яЁё]+")


def words(text):
    return [w.lower().replace("ё", "е") for w in WORD.findall(text or "")]


def strip_html(html):
    h = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html or "")
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    # Экспорт Google Docs пишет кириллицу числовыми сущностями (&#1057;).
    # Без unescape весь русский текст исходника читается как цифры — замер
    # тогда врёт про потерю всей книги.
    return unescape(h)


# ── источники ───────────────────────────────────────────────────────────
def src_pdf(path):
    """[(метка, текст)] по страницам PDF."""
    import pymupdf
    doc = pymupdf.open(path)
    out = []
    for i, page in enumerate(doc, 1):
        # Узкие колонки книги переносят слова через дефис в конце строки.
        # Без склейки половинки читаются как два отдельных слова, и любой
        # абзац с переносом выглядит потерянным, хотя в JSON он целый.
        text = HYPHEN.sub(chr(92) + '1' + chr(92) + '2', page.get_text('text'))
        out.append((f"стр.{i}", text))
    doc.close()
    return out


def src_zip(path):
    """[(метка, текст)] — экспорт Google Docs, один index.html на всё."""
    out = []
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if not name.lower().endswith((".html", ".htm")):
                continue
            raw = z.read(name).decode("utf-8", "replace")
            out.append((name, strip_html(raw)))
    return out


def src_docx(path):
    """[(метка, текст)] — абзацы и таблицы docx одним куском."""
    import docx
    d = docx.Document(path)
    buf = []
    for p in d.paragraphs:
        buf.append(p.text)
    # Объединённая ячейка возвращается python-docx на каждую покрытую
    # позицию — без отсева её текст размножается и даёт ложные «дыры».
    for t in d.tables:
        seen = set()
        for row in t.rows:
            for c in row.cells:
                key = id(c._tc)
                if key in seen:
                    continue
                seen.add(key)
                buf.append(c.text)
    return [(os.path.basename(path), "\n".join(buf))]


MD_IMAGE_DATA = re.compile(r"^\[image\d+\]:\s*<data:[^>]*>\s*$", re.MULTILINE)


def src_md(path):
    """[(метка, текст)] — markdown-экспорт Google Docs, файл целиком одним куском.

    Синтаксис markdown (`#`, `|`, `*`, `-`, `[]()`…) не зачищается отдельно:
    WORD (regex ниже) и так берёт только буквенно-цифровые последовательности,
    той же логикой, что strip_html убирает HTML-теги для .zip источников.

    Картинки экспортируются встроенным base64 в отдельных строках-сносках
    (`[image7]: <data:image/png;base64,...>`) — без зачистки их base64-мусор
    read как «слова» и топит замер покрытия в сотнях тысяч ложных слов
    (проверено 09.09.2026 на aeldari-branches: 42 картинки исказили счёт
    источника почти в шесть раз)."""
    text = open(path, encoding="utf-8", errors="replace").read()
    text = MD_IMAGE_DATA.sub(" ", text)
    return [(os.path.basename(path), text)]


def load_source(slug):
    folder, name = SOURCES[slug]
    path = os.path.join(folder, name)
    if not os.path.exists(path):
        return None, path
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        return src_pdf(path), path
    if ext == ".zip":
        return src_zip(path), path
    if ext == ".docx":
        return src_docx(path), path
    if ext == ".md":
        return src_md(path), path
    raise SystemExit(f"неизвестный тип источника: {path}")


# ── цель ────────────────────────────────────────────────────────────────
def load_target(slug):
    p = os.path.join(ROOT, "packs-src", "books", slug + ".json")
    book = json.load(open(p, encoding="utf-8"))
    buf = []
    for e in book.get("entries", []):
        buf.append(e.get("name") or "")
        for pg in e.get("pages", []):
            buf.append(pg.get("name") or "")
            buf.append(strip_html(pg.get("html")))
    return book, "\n".join(buf)


def json_text(node, buf):
    """Все строки JSON-документа подряд — имена, описания, html карточек."""
    if isinstance(node, str):
        buf.append(node)
    elif isinstance(node, list):
        for v in node:
            json_text(v, buf)
    elif isinstance(node, dict):
        for v in node.values():
            json_text(v, buf)


def corpus_all():
    """Текст ВСЕГО packs-src: книга могла отдать таблицу в карточки предметов,
    и тогда текст не потерян, а просто лежит не в журнале."""
    buf = []
    for dirpath, _dirs, files in os.walk(os.path.join(ROOT, "packs-src")):
        for fn in files:
            if fn.endswith(".json"):
                try:
                    json_text(json.load(open(os.path.join(dirpath, fn), encoding="utf-8")), buf)
                except Exception:
                    pass
    return strip_html(chr(10).join(buf))


def shingles(ws):
    return {tuple(ws[i:i + N]) for i in range(len(ws) - N + 1)}


TABLE_NOISE_RATIO = 0.85  # см. wdbc-tdgx

# wdbc-3iw: параметры локального поиска для table_order_overlap() — см. докстринг
# функции. ANCHOR_MAX_FREQ — слово из дыры годится в «якорь» (по нему ищем место
# в целевом тексте), только если оно не настолько частое, что якориться на нём
# всё равно что не якориться вообще (предлоги, «pr», «xp», числа станов). Порог
# подобран по core.json (505935 слов цели): специфичные термины оружейных таблиц
# («посох» 95, «крюк» 35) проходят, разговорная лексика правил (число вхождений
# в тысячах) — нет.
ANCHOR_MAX_FREQ = 400
MAX_ANCHORS = 6          # сколько разных редких слов дыры пробовать как якорь
MAX_POS_PER_ANCHOR = 8   # сколько вхождений каждого якоря проверять
WINDOW_WORDS_MULT = 8    # окно вокруг якоря = max(N * длина дыры, WINDOW_WORDS_MIN)
WINDOW_WORDS_MIN = 150


def build_position_index(tgt_words_list):
    """слово → отсортированный список позиций в целевом тексте (для поиска
    ближайшего окружения слова-якоря в table_order_overlap)."""
    idx = defaultdict(list)
    for i, w in enumerate(tgt_words_list):
        idx[w].append(i)
    return idx


def table_order_overlap(hole_ws, tgt_words_list, tgt_counts, pos_index):
    """Является ли «дыра» (несовпавший шингл) переставленной таблицей, а не
    настоящей пропажей текста.

    wdbc-3iw: раньше эта функция проверяла, встречаются ли слова дыры ГДЕ-
    УГОДНО в целевом тексте (Counter по всей книге, без учёта места). Это не
    вопрос «лежит ли этот текст в книге в другом порядке», а вопрос «существуют
    ли такие слова в книге вообще» — а для русской правиловой прозы это почти
    всегда «да» (предлоги, «бросок», «персонаж», «pr», «xp», числа характеристик
    повторяются по всей книге тысячи раз). В результате настоящий потерянный
    абзац (напр. описание псайкерской силы «Гефест» в core.json — имя силы
    упомянуто только в таблице требований ДРУГИХ сил, а собственный текст
    отсутствует) набирал 85%+ и прятался как «подозрение на порядок таблицы».

    Починка: перестановка таблицы — это когда те же слова стоят РЯДОМ в целевом
    тексте, просто в другом порядке (PDF читает многопрофильную ячейку оружия
    колонка за колонкой, packs-src хранит её строка за строкой — контент общий,
    находится в одном месте). Настоящая пропажа — это когда слово дыры может
    где-то мелькать по книге (в оглавлении, в таблице требований, как имя
    из другого абзаца), но именно ЭТОГО текста рядом с этими мелькающими
    словами нет.

    Поэтому вместо глобального Counter здесь: берём несколько самых редких слов
    дыры (кандидатов в «якорь» — не редкий термин не локализует ничего, см.
    ANCHOR_MAX_FREQ), для каждого вхождения такого слова в целевом тексте
    смотрим ОКНО вокруг этой позиции и считаем перекрытие мультимножеств только
    внутри окна. Берём максимум по всем проверенным якорям/позициям: если хотя
    бы одно место книги содержит почти все слова дыры рядом — это перестановка;
    если ни одно — настоящая потеря, даже если каждое слово по отдельности
    где-то в книге да встречается."""
    if not hole_ws:
        return 0.0
    c = Counter(hole_ws)
    hole_len = len(hole_ws)
    candidates = sorted(
        (w for w in c if 0 < tgt_counts.get(w, 0) <= ANCHOR_MAX_FREQ),
        key=lambda w: tgt_counts[w],
    )[:MAX_ANCHORS]
    if not candidates:
        # Либо ни одного слова дыры нет в целевом тексте вообще (точно потеря),
        # либо все слова настолько частые, что локализовать место нечем — в
        # этом случае считаем дыру настоящей: подтвердить перестановку нечем.
        return 0.0
    window = max(WINDOW_WORDS_MULT * hole_len, WINDOW_WORDS_MIN)
    best = 0.0
    for w in candidates:
        for p in pos_index.get(w, [])[:MAX_POS_PER_ANCHOR]:
            lo = max(0, p - window)
            local = Counter(tgt_words_list[lo:p + window + 1])
            matched = sum(min(n, local.get(ww, 0)) for ww, n in c.items())
            ratio = matched / hole_len
            if ratio > best:
                best = ratio
        if best >= 0.999:
            break
    return best


def _selftest():
    """wdbc-3iw: самопроверка на двух синтетических дырах — гарантирует, что
    table_order_overlap() продолжает гасить настоящий шум таблиц и перестаёт
    прятать настоящую пропажу прозы, даже без внешнего тестраннера (у этого
    инструмента нет ни pytest, ни vitest — см. тикет). Запускается на каждом
    старте main(); падает громко (SystemExit), если логику снова сломают.
    Отдельно доступна как `python tools/book-coverage.py --selftest`."""
    # ── синтетическая цель: рядом лежат ДВЕ строки оружейной таблицы (как в
    # packs-src — строка за строкой), плюс частая разговорная лексика правил,
    # разбросанная по всему тексту (как в реальной книге — "тест", "бросок",
    # "персонаж", "успех" встречаются тысячи раз и есть где угодно).
    row1 = "штурмовая винтовка 4 5 2d10 3 r imprecise primitive".split()
    row2 = "крюк 4 4 2d10 2 r tearing primitive".split()
    # частота каждого слова-филлера должна превысить ANCHOR_MAX_FREQ (как в
    # реальной книге — "и" в core.json встречается 14660 раз), иначе тест
    # ничего не проверяет: с редким филлером он попадёт в тот же локальный
    # поиск по окну, что и настоящая таблица, а не в ветку "нет якоря".
    filler = ("тест бросок персонаж успех и или в на с по " * (ANCHOR_MAX_FREQ + 100)).split()
    tgt_words_list = filler[:len(filler) // 2] + row1 + row2 + filler[len(filler) // 2:]
    tgt_counts = Counter(tgt_words_list)
    pos_index = build_position_index(tgt_words_list)

    # Дыра 1 — та же таблица, но PDF отдал её колонка за колонкой (слова те же,
    # порядок другой): должна погаситься как шум таблицы.
    reordered_table_hole = (
        "штурмовая крюк винтовка 4 4 4 5 2d10 2d10 2 r 3 r imprecise tearing primitive primitive"
    ).split()
    ratio1 = table_order_overlap(reordered_table_hole, tgt_words_list, tgt_counts, pos_index)

    # Дыра 2 — абзац, которого в целевом тексте нет НИГДЕ как связного куска,
    # но собран из слов настолько частых (>ANCHOR_MAX_FREQ), что глобальный
    # Counter (старая логика) принимал их за «слова дыры где-то есть в книге».
    # Проверяем именно баг из тикета: предлоги/союзы/лексика уровня «тест»,
    # «бросок», «персонаж», «успех» не должны выступать доказательством.
    common_word_hole = ("тест бросок персонаж успех и или в на с по " * 3).split()

    ratio2 = table_order_overlap(common_word_hole, tgt_words_list, tgt_counts, pos_index)

    fails = []
    if ratio1 < TABLE_NOISE_RATIO:
        fails.append(f"переставленная таблица должна гаситься как шум (перекрытие {ratio1:.0%} "
                      f"< порога {TABLE_NOISE_RATIO:.0%}) — table_order_overlap() недооценивает "
                      f"локальную перестановку")
    if ratio2 >= TABLE_NOISE_RATIO:
        fails.append(f"дыра из частых слов правил не должна гаситься как шум (перекрытие "
                      f"{ratio2:.0%} >= порога {TABLE_NOISE_RATIO:.0%}) — регресс исходного бага "
                      f"wdbc-3iw: частая лексика снова прячет настоящую пропажу")
    return fails


def main():
    fails = _selftest()
    if fails:
        for f in fails:
            print(f"САМОПРОВЕРКА ПРОВАЛЕНА: {f}", file=sys.stderr)
        raise SystemExit(2)
    if "--selftest" in sys.argv:
        print("самопроверка table_order_overlap() пройдена (переставленная таблица гасится, "
              "дыра из частых слов — нет)")
        return

    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = {a.split("=")[0]: (a.split("=", 1)[1] if "=" in a else True)
            for a in sys.argv[1:] if a.startswith("--")}
    hole_min = int(opts.get("--holes", 20))
    dump = opts.get("--dump")
    slugs = args or sorted(SOURCES)

    if dump:
        os.makedirs(dump, exist_ok=True)
    if opts.get("--corpus") == "all":
        CORPUS.append(corpus_all())

    print(f"{'книга':<18} {'слов ист.':>9} {'слов JSON':>9} {'покрытие':>9} {'дыр':>5} {'слов в дырах':>12}")
    print("-" * 70)
    for slug in slugs:
        chunks, path = load_source(slug)
        if chunks is None:
            print(f"{slug:<18} ИСХОДНИК НЕ НАЙДЕН: {path}")
            continue
        book, tgt_text = load_target(slug)
        if opts.get("--corpus") == "all":
            tgt_text = tgt_text + chr(10) + CORPUS[0]
        tgt_words_list = words(tgt_text)
        tgt = shingles(tgt_words_list)
        # wdbc-tdgx: многопрофильная ячейка оружия (Копьё+Посох в одной строке
        # таблицы) читается PDF-экстрактором КОЛОНКА ЗА КОЛОНКОЙ, а packs-src
        # хранит её СТРОКА ЗА СТРОКОЙ — тот же контент, другой порядок слов,
        # ни один 6-словный шингл не совпадёт. table_order_overlap() (wdbc-3iw)
        # проверяет, стоят ли слова дыры рядом ГДЕ-ТО в целевом тексте (тогда
        # это перестановка), а не просто существуют ли они в книге вообще.
        tgt_counts = Counter(tgt_words_list)
        pos_index = build_position_index(tgt_words_list)

        rows, total_src, covered, holes, hole_words = [], 0, 0, [], 0
        table_noise, table_noise_words, table_noise_dump = 0, 0, []
        for label, text in chunks:
            ws = words(text)
            total_src += len(ws)
            if len(ws) < N:
                continue
            mark = [False] * len(ws)
            for i in range(len(ws) - N + 1):
                if tuple(ws[i:i + N]) in tgt:
                    for j in range(i, i + N):
                        mark[j] = True
            covered += sum(mark)
            i = 0
            while i < len(mark):
                if mark[i]:
                    i += 1
                    continue
                j = i
                while j < len(mark) and not mark[j]:
                    j += 1
                if j - i >= hole_min:
                    hole_ws = ws[i:j]
                    ratio = table_order_overlap(hole_ws, tgt_words_list, tgt_counts, pos_index)
                    if ratio >= TABLE_NOISE_RATIO:
                        table_noise += 1
                        table_noise_words += j - i
                        table_noise_dump.append((label, j - i, " ".join(hole_ws), ratio))
                    else:
                        holes.append((label, j - i, " ".join(hole_ws), ratio))
                        hole_words += j - i
                i = j
        pct = 100.0 * covered / total_src if total_src else 0.0
        tgt_words = len(words(tgt_text))
        noise_note = f"  (+{table_noise} подозрений на порядок таблицы, {table_noise_words} слов)" if table_noise else ""
        print(f"{slug:<18} {total_src:>9} {tgt_words:>9} {pct:>8.1f}% {len(holes):>5} {hole_words:>12}{noise_note}")
        if dump:
            with open(os.path.join(dump, slug + ".txt"), "w", encoding="utf-8") as f:
                f.write(f"# {slug} — исходник {path}\n")
                f.write(f"# покрытие {pct:.1f}%  дыр {len(holes)}  слов в дырах {hole_words}"
                        f"  подозрений на порядок таблицы {table_noise} ({table_noise_words} слов)\n\n")
                for label, n, txt, ratio in sorted(holes, key=lambda h: -h[1]):
                    f.write(f"--- {label}  ({n} слов, перекрытие лексики {ratio:.0%})\n{txt}\n\n")
                # wdbc-3iw: отфильтрованное как «шум таблицы» раньше нигде не
                # выводилось — решение фильтра нечем было проверить физически.
                # Дальше — то же самое для оправданных фильтром дыр: если сюда
                # попал не переставленный ряд таблицы, а настоящая проза, это
                # значит порог/якорь фильтра снова надо сузить.
                if table_noise_dump:
                    f.write(f"\n\n# === отфильтровано как «подозрение на порядок таблицы» "
                            f"({table_noise} шт., {table_noise_words} слов) — проверить, что это правда "
                            f"переставленная таблица, а не потерянная проза ===\n\n")
                    for label, n, txt, ratio in sorted(table_noise_dump, key=lambda h: -h[1]):
                        f.write(f"--- {label}  ({n} слов, перекрытие лексики {ratio:.0%})\n{txt}\n\n")


if __name__ == "__main__":
    main()
