// Sahara 11-dbc-114: Адаптация (Ветеран Долгой Войны) — выбор Черты любого стартового Архетипа, кроме Нумена.
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const read = f => JSON.parse(fs.readFileSync(f, "utf8"));
const dir = path.resolve("packs-src/traits/Элитные_архетипы/Ветеран_Долгой_Войны");
const adaptation = read(path.join(dir, fs.readdirSync(dir).find(f => f.startsWith("Adaptation___"))));
const traitIds = new Set();
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.isDirectory()) walk(path.join(d, f.name));
    else if (f.name.endsWith(".json") && !f.name.startsWith("_")) traitIds.add(read(path.join(d, f.name))._id);
  }
})(path.resolve("packs-src/traits"));
const archetypeTraitUuids = file => (read(file).flags?.["warhammer-dbc"]?.mechanics ?? [])
  .flatMap(g => g.entries).filter(e => e.kind === "trait").map(e => e.sourceUuid);

describe("Адаптация", () => {
  const or = adaptation.flags["warhammer-dbc"].mechanics.find(g => g.operator === "OR");
  it("есть ИЛИ-группа выбора Черт", () => {
    expect(or).toBeTruthy();
    expect(or.entries.every(e => e.kind === "trait")).toBe(true);
  });
  it("каждая Черта выбора есть в паке", () => {
    for (const e of or.entries) expect(traitIds.has(e.sourceUuid.split(".").pop()), e.sourceName).toBe(true);
  });
  it("Черт Нумена нет, Черты прочих стартовых Архетипов — все", () => {
    const uuids = new Set(or.entries.map(e => e.sourceUuid));
    const numen = archetypeTraitUuids(path.resolve("packs-src/archetypes/Люди/Numen___Нумен_UPSBhx7xqNQM2g9W.json"));
    for (const u of numen) expect(uuids.has(u)).toBe(false);
    for (const d of ["Люди", "Механикус", "Астартес__Космодесантники_"]) {
      const base = path.resolve("packs-src/archetypes", d);
      for (const f of fs.readdirSync(base)) {
        if (f.startsWith("_") || f.startsWith("Numen")) continue;
        for (const u of archetypeTraitUuids(path.join(base, f))) expect(uuids.has(u), `${f}: ${u}`).toBe(true);
      }
    }
  });
});
