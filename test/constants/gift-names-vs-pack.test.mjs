// test/constants/gift-names-vs-pack.test.mjs
//
// Механику выданного Дара ищет mutationItemData(name, godKey) — ПО ИМЕНИ
// (см. test/constants/mutations-item-data.test.mjs). Значит имя в таблице
// бросков (module/constants/mutations.mjs) и имя карточки в паке — это одна
// строка, разъехавшаяся молча: ГМ бросает по таблице, получает имя, а предмета
// с таким именем в компендиуме уже нет.
//
// Так и вышло в стопке #401–#431: массовая сверка названий с книгой (#407)
// переименовала карточку в «Похититель Судьбы», а таблица осталась со старым
// «Вор Судьбы». Оба места по отдельности выглядели правильно.

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

import { GOD_GIFTS, MUTATIONS } from "../../module/constants/mutations.mjs";

const root = path.resolve(import.meta.dirname, "../..");

/** Имена карточек паков мутаций: и полное «English / Русское», и русская половина. */
function packNames(dir = path.join(root, "packs-src/mutations"), out = new Set()) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { packNames(p, out); continue; }
    if (!e.name.endsWith(".json")) continue;
    const name = JSON.parse(fs.readFileSync(p, "utf8"))?.name;
    if (!name) continue;
    out.add(String(name).trim());
    out.add(String(name).split(" / ").pop().trim());
  }
  return out;
}

describe("имена Даров и мутаций: таблица бросков против пака", () => {
  const names = packNames();

  it("в паке есть карточка каждого имени, которое может выпасть по таблице", () => {
    expect(names.size, "паки мутаций не прочитались").toBeGreaterThan(100);
    const missing = [];
    for (const [god, o] of Object.entries(GOD_GIFTS))
      for (const g of o.gifts ?? [])
        if (!names.has(g.name)) missing.push(`${god}: ${g.name}`);
    for (const m of MUTATIONS ?? [])
      if (m?.name && !names.has(m.name)) missing.push(`мутация: ${m.name}`);
    expect(missing, "Дар выпадет по броску, а предмета с таким именем нет").toEqual([]);
  });
});
