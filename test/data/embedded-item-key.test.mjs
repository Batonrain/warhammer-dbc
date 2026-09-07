// test/data/embedded-item-key.test.mjs
//
// Служебное поле `_key` у ВЛОЖЕННОГО предмета актора — это адрес записи в
// хранилище компендиума: `!actors.items!<id актора>.<id предмета>`. Оно
// НЕ выводится из документа при сборке, а берётся как есть, поэтому
// скопированный вместе с предметом чужой `_key` означает, что два разных
// документа претендуют на одну ячейку — и `npm run packs:build` падает
// целиком с «already packed and would be overwritten». Падает ВЕСЬ пак, а не
// одна карточка: в игру не попадает и всё остальное содержимое Бестиария.
//
// Так и случилось 07.09.2026 (wdbc-ju8c): четырём существам добавили Талант
// копией записи с «Гончей Плоти» — новый `_id` присвоили, а `_key` оставили
// от донора. Локальные гейты этого не видят (мир был открыт, packs:build не
// запускался), поймал только CI на пул-реквесте.
//
// Тест дешёвый и ловит ровно этот класс: `_key`, если он есть, обязан
// совпадать с парой (актор, предмет), внутри которой лежит.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(fileURLToPath(new URL("../..", import.meta.url)), "packs-src");

function listJson(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    // Книги — журналы, вложенных предметов у них нет; их страницы велики и
    // читать их тут незачем.
    if (e.isDirectory()) { if (e.name !== "books") out.push(...listJson(p)); }
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

const FILES = listJson(ROOT);

describe("вложенные предметы: _key указывает на своего носителя", () => {
  it("packs-src разобран — иначе тест зелен от пустоты", () => {
    expect(FILES.length).toBeGreaterThan(1000);
  });

  it("ни один _key не скопирован от чужого документа", () => {
    const wrong = [];
    let seen = 0;

    for (const file of FILES) {
      let doc;
      try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
      if (!doc || typeof doc !== "object" || !doc._id) continue;
      for (const item of doc.items ?? []) {
        if (!item?._key) continue;
        seen++;
        const want = `!actors.items!${doc._id}.${item._id}`;
        if (item._key !== want) {
          wrong.push(`${doc.name} / ${item.name}: ${item._key} — ожидалось ${want}`);
        }
      }
    }

    // Страховка от «проверять стало нечего»: вложенные предметы с _key в
    // паках есть, их тысячи.
    expect(seen).toBeGreaterThan(500);
    expect(wrong, wrong.join("\n")).toEqual([]);
  });
});
