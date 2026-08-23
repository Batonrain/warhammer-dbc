# tools/html-book-import.py
# ════════════════════════════════════════════════════════════════════════
#  Конвертер экспорта Google Docs (HTML, ZIP-архив) в packs-src/books/<slug>.json.
#
#  В отличие от PDF-конвейера (pdfshot.py/pdf-text.py/book-outline.py) здесь
#  не нужна картинка страницы — сам экспорт уже хранит текст, таблицы,
#  жирность и цвет как данные (CSS-классы на <span>), а не как пиксели.
#  Заголовки Google Docs (Заголовок 1/2/3) выходят как настоящие <h1>/<h2>/<h3>
#  со стабильными id — h1 -> глава (entries[]), h2 -> раздел (pages[]),
#  h3+ -> подзаголовок внутри html раздела.
#
#  Использование:
#    python tools/html-book-import.py <index.html> <slug> --title="..." --file="index.html"
#    [--images-src=<папка с images/>] [--out=packs-src/books/<slug>.json]
# ════════════════════════════════════════════════════════════════════════
import sys, os, re, json, shutil
from html import unescape
from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def parse_css(style_text):
    """Класс -> {bold, italic, color, bg}. Игнорирует свойства, которые не нужны."""
    rules = {}
    for m in re.finditer(r"\.([\w-]+)\{([^}]*)\}", style_text):
        cls, body = m.group(1), m.group(2)
        info = {}
        bm = re.search(r"font-weight:\s*(\d+|bold)", body)
        if bm and (bm.group(1) == "bold" or int(bm.group(1)) >= 700):
            info["bold"] = True
        if re.search(r"font-style:\s*italic", body):
            info["italic"] = True
        # "color:" как САМОСТОЯТЕЛЬНОЕ свойство — начало строки или после ";".
        # Одного (?<!background-) мало: пропускает border-color/border-top-color
        # и т.п. у <td> — не баг проявлялся, пока номера классов не пересекались
        # с <span>, но мог бы молча покрасить текст в цвет рамки ячейки.
        cm = re.search(r"(?:^|;)\s*color:\s*#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})", body)
        if cm and cm.group(1).lower() not in ("000000", "000"):
            info["color"] = "#" + cm.group(1)
        # background-color — почти всегда парная часть того же оформления, что
        # даёт цвету смысл (светлый текст на тёмной плашке шапки таблицы). Без
        # неё цвет остаётся сиротой: находка на Тиранидах/Аэльдари/Некронах —
        # #ffffff/#00ff00 без фона оказывались нечитаемы на светлом фоне
        # журнала Foundry. "white"/#ffffff тут исключён как фон-по-умолчанию
        # страницы Google Docs (тот же смысл, что и чёрный для текста выше).
        bgm = re.search(r"(?:^|;)\s*background-color:\s*#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})", body)
        if bgm and bgm.group(1).lower() not in ("ffffff", "fff"):
            info["bg"] = "#" + bgm.group(1)
        if info:
            rules[cls] = info
    return rules


def span_style(node, css):
    """Собранный стиль span-а по всем его классам."""
    info = {}
    for cls in (node.get("class") or []):
        info.update(css.get(cls, {}))
    return info


def unwrap_google_link(href):
    m = re.match(r"https://www\.google\.com/url\?q=([^&]+)", href or "")
    if m:
        from urllib.parse import unquote
        return unquote(m.group(1))
    return href


def inline_html(node, css, slug=None, art_map=None):
    """Рекурсивно переводит содержимое <p>/<td>/<li> в чистый HTML со стилями.

    <img> внутри инлайн-контента (например, портрет техники в ячейке
    таблицы статов) раньше терялся молча — render_image() вызывался только
    для страниц, целиком состоящих из <img> на верхнем уровне <p>. slug/
    art_map — опциональны и пробрасываются рекурсивно только там, где
    вызывающий их знает (convert_block); без них <img> просто пропускается,
    как раньше."""
    out = []
    for child in node.children:
        if isinstance(child, NavigableString):
            out.append(str(child))
            continue
        if not isinstance(child, Tag):
            continue
        if child.name == "img":
            if slug and art_map:
                fig = render_image(child, slug, art_map)
                if fig:
                    out.append(fig)
            continue
        if child.name == "a":
            href = unwrap_google_link(child.get("href"))
            out.append(f'<a href="{href}">{inline_html(child, css, slug, art_map)}</a>')
            continue
        if child.name == "br":
            out.append("<br>")
            continue
        if child.name in ("span", "sup", "sub", "b", "i", "strong", "em"):
            style = span_style(child, css)
            inner = inline_html(child, css, slug, art_map)
            if child.name in ("sup", "sub"):
                inner = f"<{child.name}>{inner}</{child.name}>"
            if style.get("bold") or child.name in ("b", "strong"):
                inner = f"<strong>{inner}</strong>"
            if style.get("italic") or child.name in ("i", "em"):
                inner = f"<em>{inner}</em>"
            if style.get("color") or style.get("bg"):
                decls = []
                if style.get("color"):
                    decls.append(f'color:{style["color"]}')
                if style.get("bg"):
                    decls.append(f'background:{style["bg"]}')
                inner = f'<span style="{";".join(decls)}">{inner}</span>'
            out.append(inner)
            continue
        # неизвестный инлайн-тег — просто содержимое
        out.append(inline_html(child, css, slug, art_map))
    return "".join(out)


def convert_block(node, css, slug, art_map):
    """<p>/<table>/<ul>/<ol> верхнего уровня -> готовый HTML-фрагмент."""
    if node.name == "p":
        # <p>, целиком состоящий из <img> — картинка, не текст
        imgs = node.find_all("img")
        if imgs and not node.get_text(strip=True):
            figs = []
            for img in imgs:
                fig = render_image(img, slug, art_map)
                if fig:
                    figs.append(fig)
            return "".join(figs)
        # пустая строка с форматированием (пустой <strong>/<em> в исходнике)
        # даёт непустую HTML-строку ("<strong></strong>") при пустом видимом
        # тексте — проверять надо текст, не длину получившегося фрагмента.
        if not node.get_text(strip=True):
            return ""
        inner = inline_html(node, css, slug, art_map).strip()
        if not inner:
            return ""
        return f"<p>{inner}</p>"
    if node.name in ("h1", "h2", "h3", "h4", "h5", "h6"):
        # заголовки внутри блока (после первого, который уже стал entries/pages)
        level = min(int(node.name[1]) + 1, 6)
        inner = inline_html(node, css, slug, art_map).strip()
        return f"<h{level}>{inner}</h{level}>"
    if node.name == "table":
        rows = []
        # Строки только ЭТОЙ таблицы — recursive=False по контейнеру (сама
        # <table> или её <tbody>), а не find_all(recursive=True): иначе
        # строки вложенной <table> внутри <td> подхватывались как строки
        # внешней и дублировались/схлопывались (баг нашла сверка Аэльдари:
        # Ответвления — 44 места).
        container = node.find("tbody", recursive=False) or node
        for tr in container.find_all("tr", recursive=False):
            cells = []
            for td in tr.find_all(["td", "th"], recursive=False):
                tag = "th" if td.name == "th" else "td"
                attrs = ""
                if td.get("colspan") and td.get("colspan") != "1":
                    attrs += f' colspan="{td["colspan"]}"'
                if td.get("rowspan") and td.get("rowspan") != "1":
                    attrs += f' rowspan="{td["rowspan"]}"'
                cell_html = cell_content_html(td, css, slug, art_map)
                cells.append(f"<{tag}{attrs}>{cell_html}</{tag}>")
            if cells:
                rows.append(f"<tr>{''.join(cells)}</tr>")
        if not rows:
            return ""
        return f"<table>{''.join(rows)}</table>"
    if node.name in ("ul", "ol"):
        items = []
        for li in node.find_all("li", recursive=False):
            t = inline_html(li, css, slug, art_map).strip()
            if t:
                items.append(f"<li>{t}</li>")
        if not items:
            return ""
        return f"<{node.name}>{''.join(items)}</{node.name}>"
    return ""


def cell_content_html(td, css, slug, art_map):
    """Содержимое <td>/<th> — не только <p> (как было раньше: заголовок
    <h3> внутри одноячеечной таблицы-"карточки" молча пропадал, оставляя
    пустой <td></td> — баг нашла сверка Аэльдари: Ответвления, 8 мест),
    но и вложенные <table>/<ul>/<ol>/<h1-6> через тот же convert_block —
    не расплющивает их в один текстовый блок, как старый
    find_all("p", recursive=True)."""
    parts = []
    for child in td.children:
        if isinstance(child, NavigableString):
            continue
        if not isinstance(child, Tag):
            continue
        if child.name in ("p", "table", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6"):
            frag = convert_block(child, css, slug, art_map)
            if frag:
                parts.append(frag)
    return "".join(parts)


def render_image(img, slug, art_map):
    src = img.get("src", "")
    base = os.path.basename(src)
    if base not in art_map:
        return ""
    dest_name = art_map[base]
    w = img.get("width", "")
    h = img.get("height", "")
    if not (w and h):
        # у этого экспорта Google Docs <img> не несёт width/height как
        # HTML-атрибуты — размер задан только через style="width:...px;
        # height:...px". Без этого фолбэка картинка рендерится без указанных
        # размеров вовсе (найдено на Аэльдари/Аэльдари: Ответвления — 23
        # картинки без width/height, хотя art_map их находил и вставлял).
        style = img.get("style", "")
        wm = re.search(r"width:\s*([\d.]+)px", style)
        hm = re.search(r"height:\s*([\d.]+)px", style)
        if wm:
            w = str(round(float(wm.group(1))))
        if hm:
            h = str(round(float(hm.group(1))))
    attrs = f' width="{w}"' if w else ""
    attrs += f' height="{h}"' if h else ""
    return (f'<figure><img src="systems/warhammer-dbc/assets/art/{slug}/{dest_name}"'
            f' alt=""{attrs}></figure>')


def copy_images(images_src_dir, slug):
    """images/imageN.ext -> assets/art/<slug>/imageN.ext, возвращает базовое-имя -> новое-имя."""
    art_map = {}
    if not images_src_dir or not os.path.isdir(images_src_dir):
        return art_map
    dest_dir = os.path.join(ROOT, "assets", "art", slug)
    os.makedirs(dest_dir, exist_ok=True)
    for fn in sorted(os.listdir(images_src_dir)):
        shutil.copy2(os.path.join(images_src_dir, fn), os.path.join(dest_dir, fn))
        art_map[fn] = fn
    return art_map


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = dict((a[2:].split("=", 1) + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
    html_path, slug = args[0], args[1]
    title = opts.get("title", slug)
    file_field = opts.get("file", os.path.basename(html_path))
    out_path = opts.get("out", f"packs-src/books/{slug}.json")
    images_src = opts.get("images-src")

    art_map = copy_images(images_src, slug) if images_src else {}

    raw = open(html_path, encoding="utf-8").read()
    soup = BeautifulSoup(raw, "html.parser")
    css = parse_css(soup.style.string or "") if soup.style else {}

    body = soup.body
    entries = []
    cur_chapter = None
    cur_page = None
    page_counter = 0
    HEADING_LEVELS = {"h2": 1, "h3": 2, "h4": 3, "h5": 4, "h6": 5}

    def flush_page():
        nonlocal cur_page
        if cur_page and cur_page["html"].strip():
            page = {
                "name": cur_page["name"],
                "pdfPage": cur_page["idx"],
                "html": cur_page["html"],
            }
            if cur_page["level"] > 1:
                page["level"] = cur_page["level"]
            cur_chapter["pages"].append(page)
        cur_page = None

    for node in body.children:
        if not isinstance(node, Tag):
            continue
        if node.name == "h1":
            flush_page()
            name = unescape(node.get_text(" ", strip=True))
            cur_chapter = {"name": name, "pages": []}
            entries.append(cur_chapter)
            # обложка главы — картинка прямо внутри <h1>, без своего текста
            # заголовка (например разворот-обложка расы) — раньше терялась
            # молча, для неё вообще не было страницы (сверка Некрон, 5 мест)
            cover_figs = "".join(
                f for f in (render_image(img, slug, art_map) for img in node.find_all("img")) if f
            )
            if cover_figs:
                page_counter += 1
                cur_chapter["pages"].append({"name": name, "pdfPage": page_counter, "html": cover_figs})
            continue
        if node.name in HEADING_LEVELS:
            # каждый уровень заголовка (h2+) — своя запись pages[], как у
            # book-outline.py для PDF-закладок: плоский список с полем level,
            # не вложенность внутри html одной большой страницы.
            flush_page()
            if cur_chapter is None:
                cur_chapter = {"name": title, "pages": []}
                entries.append(cur_chapter)
            page_counter += 1
            name = unescape(node.get_text(" ", strip=True))
            # inline_html(node, css) без slug/art_map — старая версия молча
            # роняла <img> прямо внутри заголовка (свёрстанный вместе с
            # текстом крупный арт главы — сверка Некрон, 5 мест). Текст
            # заголовка по-прежнему без slug/art_map (незачем вкладывать
            # <img>/<figure> внутрь <hN>), а картинки выносятся отдельным
            # <figure> сразу после закрывающего тега.
            heading_inner = inline_html(node, css).strip() or name
            heading_figs = "".join(
                f for f in (render_image(img, slug, art_map) for img in node.find_all("img")) if f
            )
            level = HEADING_LEVELS[node.name]
            htag = f"h{min(level + 1, 6)}"
            cur_page = {
                "name": name, "idx": page_counter, "level": level,
                "html": f"<{htag}>{heading_inner}</{htag}>{heading_figs}",
            }
            continue
        frag = convert_block(node, css, slug, art_map)
        if not frag:
            continue
        if cur_page is None:
            if cur_chapter is None:
                cur_chapter = {"name": title, "pages": []}
                entries.append(cur_chapter)
            page_counter += 1
            cur_page = {"name": cur_chapter["name"], "idx": page_counter, "level": 1, "html": ""}
        cur_page["html"] += frag
    flush_page()

    data = {
        "slug": slug,
        "title": title,
        "file": file_field,
        "pdfPages": page_counter,
        "entries": entries,
    }
    out_full = os.path.join(ROOT, out_path)
    json.dump(data, open(out_full, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=1)

    total_pages = sum(len(e["pages"]) for e in entries)
    print(f"Готово: {slug} — {len(entries)} глав, {total_pages} разделов -> {out_path}")
    if art_map:
        print(f"Артов скопировано: {len(art_map)} -> assets/art/{slug}/")


if __name__ == "__main__":
    main()
