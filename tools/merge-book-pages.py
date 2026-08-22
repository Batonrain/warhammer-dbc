#!/usr/bin/env python3
"""Трёхстороннее слияние packs-src/books/*.json по страницам, не по строкам.

Зачем: entries[].pages[] хранит pdfPage разреженно — только на первой
странице-объекте физического листа PDF, дальше объекты того же листа его не
повторяют. Слияние по значению pdfPage построчно поэтому ненадёжно: чтобы
сопоставить страницы между версиями, номер листа нужно протянуть вперёд от
последнего явного pdfPage, а затем сравнивать по (имя раздела, номер листа,
позиция внутри листа).

Без базовой версии (состояние файла в момент начала правки) невозможно
отличить «эту страницу поменяла другая сессия» от «эту страницу поменял я» —
обе выглядят как «отличается от live». Поэтому вход трёхсторонний, как у
git merge: --base (снимок на момент начала работы), --edited (та же копия
после правок), --live (текущий реальный файл, в него сливаем).

Использование:
  python tools/merge-book-pages.py --base b.json --edited e.json --live l.json
    (по умолчанию — dry-run, только отчёт, ничего не пишет)
  ... --apply
    (пишет live только там, где слияние однозначно; при любом настоящем
    конфликте останавливается ДО записи и печатает список конфликтов —
    в live в этом случае ничего не меняется, разбирать конфликты вручную)
"""
import argparse
import io
import json
import sys

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


_UNSET = object()  # "физический номер листа ещё не установлен"


def page_keys(entry_name, pages):
    """Вернуть список (ключ, объект-страница) для одной entry.

    Ключ — (имя раздела, протянутый вперёд номер физического листа,
    позиция внутри этого листа). Несколько заголовков подряд могут явно
    повторять один и тот же pdfPage (несколько разделов стартуют на одном
    физическом листе) — это НЕ новый лист, позиция внутри него просто растёт.
    pdfPage None наследует последнее известное значение; если pdfPage вообще
    не встречался — физический номер остаётся None (служебный раздел вне PDF).
    """
    out = []
    current = _UNSET
    pos_in_page = 0
    started = False
    for p in pages:
        raw = p.get("pdfPage")
        new_current = raw if raw is not None else current
        if not started or new_current != current:
            pos_in_page = 0
        else:
            pos_in_page += 1
        current = new_current
        started = True
        physical = current if current is not _UNSET else None
        key = (entry_name, physical, pos_in_page)
        out.append((key, p))
    return out


def flatten(doc):
    """entries[] -> {ключ: объект-страница} по всему документу."""
    flat = {}
    order = []
    for entry in doc.get("entries", []):
        for key, page in page_keys(entry.get("name", ""), entry.get("pages", [])):
            if key in flat:
                # Совпадение ключа внутри одной версии — структура не такая
                # плоская, как ожидал скрипт. Не гадать.
                raise SystemExit(
                    f"Неоднозначный ключ страницы {key} — совпадает дважды в "
                    f"одном документе. Ручное слияние, скрипт не поможет."
                )
            flat[key] = page
            order.append(key)
    return flat, order


def content_of(page):
    return (page.get("html"), page.get("checked"), page.get("name"))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", required=True, help="снимок live на момент начала правки")
    ap.add_argument("--edited", required=True, help="та же копия после правок")
    ap.add_argument("--live", required=True, help="текущий реальный файл (пишем сюда)")
    ap.add_argument("--apply", action="store_true", help="реально записать live (по умолчанию — только отчёт)")
    args = ap.parse_args()

    base_doc = load(args.base)
    edited_doc = load(args.edited)
    live_doc = load(args.live)

    base_flat, _ = flatten(base_doc)
    edited_flat, edited_order = flatten(edited_doc)
    live_flat, live_order = flatten(live_doc)

    to_apply = []      # (ключ, новая_страница) — от edited, применяется в live
    conflicts = []     # ключ — обе стороны поменяли по-разному
    structural = []    # ключи, которых не было в base — новые/удалённые разделы

    all_keys = set(base_flat) | set(edited_flat) | set(live_flat)
    for key in all_keys:
        in_base = key in base_flat
        in_edited = key in edited_flat
        in_live = key in live_flat

        if not in_base:
            # Появилось уже после снимка — либо мы сами добавили раздел,
            # либо кто-то другой. Не автоматизируем, только на разбор.
            structural.append(key)
            continue
        if not in_live:
            # Страница пропала из live с момента снимка (кто-то удалил/
            # переструктурировал раздел). Не перезаписываем вслепую.
            structural.append(key)
            continue

        base_c = content_of(base_flat[key])
        edited_c = content_of(edited_flat[key]) if in_edited else None
        live_c = content_of(live_flat[key])

        we_changed = in_edited and edited_c != base_c
        they_changed = live_c != base_c

        if not we_changed:
            continue  # мы эту страницу не трогали — live её касается сам, не лезем
        if not they_changed:
            to_apply.append((key, edited_flat[key]))
        elif edited_c == live_c:
            continue  # оба пришли к одному и тому же — уже совпадает
        else:
            conflicts.append(key)

    print(f"К применению без конфликта: {len(to_apply)}")
    print(f"Настоящих конфликтов (обе стороны поменяли по-разному): {len(conflicts)}")
    print(f"Структурных расхождений (разделы появились/исчезли с момента base): {len(structural)}")

    if conflicts or structural:
        print("\nОстановлено — есть что разобрать руками, live не тронут.")
        for key in conflicts:
            print(f"  КОНФЛИКТ: {key}")
        for key in structural:
            print(f"  СТРУКТУРА: {key}")
        sys.exit(1)

    if not args.apply:
        print("\nDry-run: live не тронут. Повторить с --apply, чтобы записать.")
        for key, _ in to_apply:
            print(f"  применил бы: {key}")
        return

    # Применяем точечно: находим тот же ключ в live_doc "вживую" (не в
    # плоском словаре — там ссылки на те же объекты, так что мутация
    # словаря уже меняет live_doc).
    key_to_new = dict(to_apply)
    applied = 0
    for entry in live_doc.get("entries", []):
        for key, page in page_keys(entry.get("name", ""), entry.get("pages", [])):
            if key in key_to_new:
                new_page = key_to_new[key]
                page["html"] = new_page.get("html")
                if "checked" in new_page:
                    page["checked"] = new_page["checked"]
                if "pdfPage" in new_page:
                    page["pdfPage"] = new_page["pdfPage"]
                applied += 1

    # Формат ровно как у распаковщика (tools/unpack.mjs:
    # `JSON.stringify(source, null, 1) + "\n"`): отступ в ОДИН пробел и перевод
    # строки в конце. Иначе первый же --apply переписывает файл книги целиком, и
    # третий шаг CI (packs:build && packs:unpack && git diff --exit-code) видит
    # дифф на всю книгу вместо правленых страниц.
    with open(args.live, "w", encoding="utf-8") as f:
        json.dump(live_doc, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print(f"\nПрименено страниц: {applied}. {args.live} обновлён.")


if __name__ == "__main__":
    main()
