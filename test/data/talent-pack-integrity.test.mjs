// test/data/talent-pack-integrity.test.mjs
//
// Дубли в паке talents (сверка «Склонности», 04.10.2026): Savant Immaterial,
// Atramentar и Hellbound лежали и в корне пака, и в папке своего Элитного
// Архетипа. Архетипы выдавали корневую копию — без признака «Элитный», с другим
// написанием имени. Тест ловит этот класс целиком: одно имя — одна запись, и
// каждая ссылка архетипа на Талант указывает на существующую запись.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

function jsonFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...jsonFiles(p));
    else if (e.name.endsWith(".json") && e.name !== "_Folder.json") out.push(p);
  }
  return out;
}
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

describe("пак talents: целостность", () => {
  const talents = jsonFiles(join(ROOT, "packs-src/talents")).map(read).filter(j => j.type === "talent");

  it("имя Таланта в паке встречается один раз", () => {
    const seen = new Map();
    for (const t of talents) seen.set(t.name, (seen.get(t.name) || 0) + 1);
    const dup = [...seen].filter(([, n]) => n > 1).map(([name]) => name);
    expect(dup).toEqual([]);
  });

  it("ссылки Элитных Архетипов на Таланты ведут на существующие записи", () => {
    const ids = new Set(talents.map(t => t._id));
    const dead = [];
    for (const p of jsonFiles(join(ROOT, "packs-src/elite-archetypes"))) {
      const text = readFileSync(p, "utf8");
      for (const m of text.matchAll(/Compendium\.warhammer-dbc\.talents\.Item\.([A-Za-z0-9]{16})/g))
        if (!ids.has(m[1])) dead.push(`${p.split(/[\/]/).pop()} → ${m[1]}`);
    }
    expect(dead).toEqual([]);
  });
});

describe("папки Талантов Элитных Архетипов отпираются архетипом с тем же именем", () => {
  // Замок папки в пикере (sheets/item-picker.mjs::talentGroupLock) сверяет имя
  // папки с именем Элитного Архетипа на листе. Папка «Сигиллит» при архетипе
  // «Последователь Ордена Сигиллитов» не открывалась никому.
  it("для каждой папки есть архетип, у которого она открывается", async () => {
    const { hasEliteArchetype } = await import("../../module/rules/predicates.mjs");
    const names = jsonFiles(join(ROOT, "packs-src/elite-archetypes")).map(read)
      .filter(j => j.type === "eliteArchetype").map(j => j.name);
    const base = join(ROOT, "packs-src/talents/Элитные_архетипы");
    const folders = readdirSync(base, { withFileTypes: true }).filter(e => e.isDirectory())
      .map(e => read(join(base, e.name, "_Folder.json")).name);
    const locked = folders.filter(f => !names.some(n => hasEliteArchetype({ system: { eliteArchetype: n } }, f)));
    expect(locked).toEqual([]);
  });
});
