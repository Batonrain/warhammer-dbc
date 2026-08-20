# tools/book-outline.py
# ════════════════════════════════════════════════════════════════════════
#  Скелет книги из закладок PDF: боковая панель PDF и есть оглавление книги.
#
#  Закладка уровня 1 -> глава (JournalEntry), закладки глубже -> страницы
#  (JournalEntryPage) с сохранением уровня вложенности в поле level, чтобы
#  оглавление журнала повторяло структуру книги. Для каждой закладки
#  считается диапазон страниц PDF: от её страницы до начала следующей
#  закладки того же или более высокого уровня.
#
#  Использование:
#    python tools/book-outline.py <книга.pdf> [--json=файл]
# ════════════════════════════════════════════════════════════════════════
import sys, json, pymupdf

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opts = dict((a[2:].split("=") + [True])[:2] for a in sys.argv[1:] if a.startswith("--"))
doc = pymupdf.open(args[0])
toc = doc.get_toc()

# конец раздела — начало следующей закладки того же или более высокого уровня
spans = []
for i, (lvl, title, pg) in enumerate(toc):
    end = doc.page_count
    for lvl2, _, pg2 in toc[i + 1:]:
        if lvl2 <= lvl and pg2 >= pg:
            end = max(pg, pg2 - (1 if pg2 > pg else 0)); break
    spans.append((lvl, title, pg, end))

chapters = []
for lvl, title, pg, end in spans:
    if lvl == 1:
        chapters.append({"name": title, "pdfPage": pg, "pdfEnd": end, "pages": []})
    elif chapters:
        chapters[-1]["pages"].append({"name": title, "pdfPage": pg, "pdfEnd": end,
                                      "level": min(lvl - 1, 6), "html": ""})

out = {"pdfPages": doc.page_count, "entries": chapters}
if opts.get("json"):
    json.dump(out, open(opts["json"], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for c in chapters:
    print(f"\n### {c['name']}  (PDF {c['pdfPage']}–{c['pdfEnd']}), разделов {len(c['pages'])}")
    for p in c["pages"]:
        span = f"{p['pdfPage']}" if p["pdfPage"] == p["pdfEnd"] else f"{p['pdfPage']}–{p['pdfEnd']}"
        print(f"   {'  ' * (p['level'] - 1)}{p['name'][:46]:48} PDF {span}")
